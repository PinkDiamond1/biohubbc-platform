import { QueryResult } from 'pg';
import SQL from 'sql-template-strings';
import { getKnex, getKnexQueryBuilder } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { EMLFile } from '../utils/media/eml/eml-file';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

export interface ISpatialComponentCount {
  spatial_type: string;
  count: number;
}

export interface ISearchSubmissionCriteria {
  keyword?: string;
  spatial?: string;
}

export interface IInsertSubmissionRecord {
  source_transform_id: number;
  uuid: string;
  record_effective_date: string;
  input_key: string;
  input_file_name: string;
  eml_source: string;
  eml_json_source: string;
  darwin_core_source: string;
}

export interface ISubmissionRecordWithSpatial {
  id: string;
  source: string;
  observation_count: number;
}

/**
 * Submission table model.
 *
 * @export
 * @interface ISubmissionModel
 */
export interface ISubmissionModel {
  submission_id: number;
  source_transform_id: number;
  uuid: string;
  record_effective_date: string;
  record_end_date: string | null;
  input_key: string | null;
  input_file_name: string | null;
  eml_source: string | null;
  eml_json_source: string | null;
  darwin_core_source: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

export interface ISubmissionModelWithStatus extends ISubmissionModel {
  submission_status: string;
}

/**
 * Submission source transform table model.
 *
 * @export
 * @interface ISourceTransformModel
 */
export interface ISourceTransformModel {
  source_transform_id: number;
  system_user_id: number;
  version: number;
  metadata_transform: string | null;
  metadata_index: string | null;
  record_effective_date: string;
  record_end_date: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

export enum SUBMISSION_STATUS_TYPE {
  'PUBLISHED' = 'Published',
  'REJECTED' = 'Rejected',
  'SYSTEM_ERROR' = 'System Error',
  //Success
  'OUT_DATED_RECORD' = 'Out Dated Record',
  'INGESTED' = 'Ingested',
  'UPLOADED' = 'Uploaded',
  'VALIDATED' = 'Validated',
  'SECURED' = 'Secured',
  'EML_INGESTED' = 'EML Ingested',
  'EML_TO_JSON' = 'EML To JSON',
  'METADATA_TO_ES' = 'Metadata To ES',
  'NORMALIZED' = 'Normalized',
  'SPATIAL_TRANSFORM_UNSECURE' = 'Spatial Transform Unsecure',
  'SPATIAL_TRANSFORM_SECURE' = 'Spatial Transform Secure',
  //Failure
  'FAILED_INGESTION' = 'Failed Ingestion',
  'FAILED_UPLOAD' = 'Failed Upload',
  'FAILED_VALIDATION' = 'Failed Validation',
  'FAILED_SECURITY' = 'Failed Security',
  'FAILED_EML_INGESTION' = 'Failed EML Ingestion',
  'FAILED_EML_TO_JSON' = 'Failed EML To JSON',
  'FAILED_METADATA_TO_ES' = 'Failed Metadata To ES',
  'FAILED_NORMALIZATION' = 'Failed Normalization',
  'FAILED_SPATIAL_TRANSFORM_UNSECURE' = 'Failed Spatial Transform Unsecure',
  'FAILED_SPATIAL_TRANSFORM_SECURE' = 'Failed Spatial Transform Secure'
}

export enum SUBMISSION_MESSAGE_TYPE {
  'NOTICE' = 'Notice',
  'ERROR' = 'Error',
  'WARNING' = 'Warning',
  'DEBUG' = 'Debug'
}

/**
 * A repository class for accessing submission data.
 *
 * @export
 * @class SubmissionRepository
 * @extends {BaseRepository}
 */
export class SubmissionRepository extends BaseRepository {
  async findSubmissionByCriteria(criteria: ISearchSubmissionCriteria): Promise<{ submission_id: number }[]> {
    const queryBuilder = getKnexQueryBuilder<any, { project_id: number }>()
      .select('submission.submission_id')
      .from('submission')
      .leftJoin('occurrence', 'submission.submission_id', 'occurrence.submission_id');

    if (criteria.keyword) {
      queryBuilder.and.where(function () {
        this.or.whereILike('occurrence.taxonid', `%${criteria.keyword}%`);
        this.or.whereILike('occurrence.lifestage', `%${criteria.keyword}%`);
        this.or.whereILike('occurrence.sex', `%${criteria.keyword}%`);
        this.or.whereILike('occurrence.vernacularname', `%${criteria.keyword}%`);
        this.or.whereILike('occurrence.individualcount', `%${criteria.keyword}%`);
      });
    }

    if (criteria.spatial) {
      const geometryCollectionSQL = generateGeometryCollectionSQL(JSON.parse(criteria.spatial));

      const sqlStatement = SQL`
      public.ST_INTERSECTS(
        geography,
        public.geography(
          public.ST_Force2D(
            public.ST_SetSRID(`;

      sqlStatement.append(geometryCollectionSQL);

      sqlStatement.append(`,
              4326
            )
          )
        )
      )`);

      queryBuilder.and.whereRaw(sqlStatement.sql, sqlStatement.values);
    }

    queryBuilder.groupBy('submission.submission_id');

    const response = await this.connection.knex<{ submission_id: number }>(queryBuilder);

    return response.rows;
  }

  /**
   * Insert a new submission record.
   *
   * @param {IInsertSubmissionRecord} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionRecord(submissionData: IInsertSubmissionRecord): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        source_transform_id,
        uuid,
        record_effective_date,
        input_key,
        input_file_name,
        eml_source,
        darwin_core_source
      ) VALUES (
        ${submissionData.source_transform_id},
        ${submissionData.uuid},
        ${submissionData.record_effective_date},
        ${submissionData.input_key},
        ${submissionData.input_file_name},
        ${submissionData.eml_source},
        ${submissionData.darwin_core_source}
      )
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission record', [
        'SubmissionRepository->insertSubmissionRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update the `input_key` column of a submission record.
   *
   * @param {number} submissionId
   * @param {IInsertSubmissionRecord['input_key']} inputKey
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionRecordInputKey(
    submissionId: number,
    inputKey: IInsertSubmissionRecord['input_key']
  ): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      UPDATE
        submission
      SET
        input_key = ${inputKey}
      WHERE
        submission_id = ${submissionId}
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission record key', [
        'SubmissionRepository->updateSubmissionRecordInputKey',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update the `eml_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {EMLFile} file
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionRecordEMLSource(submissionId: number, file: EMLFile): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      UPDATE
        submission
      SET
      eml_source = ${file.emlFile.buffer.toString()}
      WHERE
        submission_id = ${submissionId}
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission record source', [
        'SubmissionRepository->updateSubmissionRecordEMLSource',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update the `eml_json_source` column of a submission record.
   *
   * @param {number} submissionId
   * @param {IInsertSubmissionRecord['eml_json_source']} EMLJSONSource
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionRecordEMLJSONSource(
    submissionId: number,
    EMLJSONSource: IInsertSubmissionRecord['eml_json_source']
  ): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      UPDATE
        submission
      SET
      eml_json_source = ${EMLJSONSource}
      WHERE
        submission_id = ${submissionId}
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission record eml json', [
        'SubmissionRepository->updateSubmissionRecordEMLJSONSource',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submission record by primary id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModel>}
   * @memberof SubmissionRepository
   */
  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<ISubmissionModel> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission
      WHERE
        submission_id = ${submissionId};
    `;

    const response = await this.connection.sql<ISubmissionModel>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission record', [
        'SubmissionRepository->getSubmissionRecordBySubmissionId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submission_id from uuid.
   *
   * @param {number} uuid
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async getSubmissionIdByUUID(uuid: string): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      SELECT
        submission_id
      FROM
        submission
      WHERE
        uuid = ${uuid}
      AND
        record_end_date IS NULL;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    return response.rows[0];
  }

  /**
   * Get submission eml json by dataset id.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<string>}
   * @memberof SubmissionRepository
   */
  async getSubmissionRecordEMLJSONByDatasetId(datasetId: string): Promise<QueryResult<{ eml_json_source: string }>> {
    const sqlStatement = SQL`
      SELECT
        eml_json_source
      FROM
        submission
      WHERE
        submission.uuid = ${datasetId}
      AND
        record_end_date IS NULL;
    `;

    return this.connection.sql<{ eml_json_source: string }>(sqlStatement);
  }

  /**
   * Get spatial component counts by dataset id for admins
   *
   * @param {string} datasetId
   * @return {*}  {Promise<ISpatialComponentCount[]>}
   * @memberof SubmissionRepository
   */
  async getSpatialComponentCountByDatasetIdAsAdmin(datasetId: string): Promise<ISpatialComponentCount[]> {
    const sqlStatement = SQL`
        SELECT
          features_array #> '{properties, type}' spatial_type,
          count(features_array #> '{properties, type}')::integer count
        FROM 
          submission_spatial_component ssc,
          jsonb_array_elements(ssc.spatial_component -> 'features') features_array,
          submission s
        WHERE s.uuid = ${datasetId}
        AND ssc.submission_id = s.submission_id
        AND s.record_end_date is null
        GROUP BY spatial_type;
      `;
    const response = await this.connection.sql<ISpatialComponentCount>(sqlStatement);
    return response.rows;
  }

  /**
   * Get spatial component counts by dataset id applying security rules
   *
   * @param {string} datasetId
   * @return {*}  {Promise<ISpatialComponentCount[]>}
   * @memberof SubmissionRepository
   */
  async getSpatialComponentCountByDatasetId(datasetId: string): Promise<ISpatialComponentCount[]> {
    const knex = getKnex();
    const queryBuilder = knex
      // get security transforms
      .with('with_user_security_transform_exceptions', (qb) => {
        qb.select(knex.raw('array_agg(suse.security_transform_id) as user_security_transform_exceptions'))
          .from('system_user_security_exception as suse')
          .where('suse.system_user_id', this.connection.systemUserId());
      })
      // filter spatial components for data set
      .with(
        'with_filtered_spatial_component_with_security_transforms',
        knex.raw(`
          SELECT 
            array_remove(array_agg(sts.security_transform_id), null) as spatial_component_security_transforms,
            ssc.spatial_component,
            ssc.secured_spatial_component
          FROM 
            submission_spatial_component ssc,
            security_transform_submission sts,
            submission s
          WHERE sts.submission_spatial_component_id = ssc.submission_spatial_component_id
          AND ssc.submission_id = s.submission_id
          AND s.record_end_date is null
          AND s.uuid = '${datasetId}'
          GROUP BY ssc.spatial_component, ssc.secured_spatial_component
        `)
      )
      // perform transforms
      .with(
        'combined_spatial_components',
        knex.raw(`
          SELECT 
          case
            when
              wuste.user_security_transform_exceptions @> wfscwst.spatial_component_security_transforms
            then
              wfscwst.spatial_component
            else
              coalesce(wfscwst.secured_spatial_component, wfscwst.spatial_component)
          end as spatial_data
          FROM with_filtered_spatial_component_with_security_transforms as wfscwst, with_user_security_transform_exceptions as wuste
        `)
      )
      // count and group filtered spatial data
      .with(
        'results',
        knex.raw(`
          SELECT 
            features_array #> '{properties, type}' spatial_type,
            count(features_array #> '{properties, type}')::integer count
          FROM
            combined_spatial_components csc,
            jsonb_array_elements(csc.spatial_data -> 'features') features_array
          GROUP BY spatial_type
        `)
      )
      .select()
      .from('results');

    const response = await this.connection.knex<ISpatialComponentCount>(queryBuilder);
    return response.rows;
  }
  /**
   * Update record_end_date of submission id
   *
   * @param {number} submissionId
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async setSubmissionEndDateById(submissionId: number): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
    UPDATE
      submission
    SET
      record_end_date = now()
    WHERE
      submission_id = ${submissionId}
    AND
      record_end_date is null
    RETURNING
      submission_id;
  `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update end date in submission record', [
        'SubmissionRepository->setSubmissionEndDateById',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submission source transform record by associated source system user id.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSourceTransformRecordBySystemUserId(systemUserId: number, version?: string): Promise<ISourceTransformModel> {
    const queryBuilder = getKnexQueryBuilder()
      .select('*')
      .from('source_transform')
      .where('system_user_id', systemUserId)
      .and.where('record_end_date', null);

    if (version) {
      queryBuilder.and.where('version', version);
    }

    const response = await this.connection.knex<ISourceTransformModel>(queryBuilder);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission source transform record', [
        'SubmissionRepository->getSourceTransformRecordBySystemUserId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submissions metadata json representation.
   *
   * @param {number} sourceTransformId
   * @param {string} transform
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSubmissionMetadataJson(submissionId: number, transform: string): Promise<string> {
    const response = await this.connection.query<{ result_data: any }>(transform, [submissionId]);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to transform submission eml to json', [
        'SubmissionRepository->getSubmissionMetadataJson',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].result_data;
  }

  /**
   * Fetch a submission source transform record by associated source transform id.
   *
   * @param {number} sourceTransformId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSourceTransformRecordBySourceTransformId(sourceTransformId: number): Promise<ISourceTransformModel> {
    const sqlStatement = SQL`
        SELECT
          *
        FROM
          source_transform
        WHERE
          source_transform_id = ${sourceTransformId}
      `;

    const response = await this.connection.sql<ISourceTransformModel>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission source transform record', [
        'SubmissionRepository->getSourceTransformRecordBySourceTransformId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new submission status record.
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @return {*}  {Promise<{ submission_status_id: number; submission_status_type_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionStatus(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE
  ): Promise<{ submission_status_id: number; submission_status_type_id: number }> {
    const sqlStatement = SQL`
    INSERT INTO submission_status (
      submission_id,
      submission_status_type_id,
      event_timestamp
    ) VALUES (
      ${submissionId},
      (
        SELECT
          submission_status_type_id
        FROM
          submission_status_type
        WHERE
          name = ${submissionStatusType}
      ),
      now()
    )
    RETURNING
      submission_status_id,
      submission_status_type_id;
  `;

    const response = await this.connection.sql<{ submission_status_id: number; submission_status_type_id: number }>(
      sqlStatement
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission status record', [
        'SubmissionRepository->insertSubmissionStatus',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a submission message record.
   *
   * @param {number} submissionStatusId
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @return {*}  {Promise<{ submission_message_id: number; submission_message_type_id: number }>}
   * @memberof SubmissionRepository
   */
  async insertSubmissionMessage(
    submissionStatusId: number,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE,
    submissionMessage: string
  ): Promise<{ submission_message_id: number; submission_message_type_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_message (
        submission_status_id,
        submission_message_type_id,
        event_timestamp,
        message
      ) VALUES (
        ${submissionStatusId},
        (
          SELECT
            submission_message_type_id
          FROM
            submission_message_type
          WHERE
            name = ${submissionMessageType}
        ),
        now(),
        ${submissionMessage}
      )
      RETURNING
        submission_message_id,
        submission_message_type_id;
    `;

    const response = await this.connection.sql<{ submission_message_id: number; submission_message_type_id: number }>(
      sqlStatement
    );

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission message record', [
        'SubmissionRepository->insertSubmissionMessage',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch a submission record by primary id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModel>}
   * @memberof SubmissionRepository
   */
  async listSubmissionRecords(): Promise<ISubmissionModelWithStatus[]> {
    const sqlStatement = SQL`
      SELECT
        t1.submission_status,
        s.*
      FROM
        submission s
      LEFT JOIN
        (SELECT DISTINCT ON (ss.submission_id)
          ss.submission_id,
          sst.name AS submission_status
        FROM
          submission_status ss
        LEFT JOIN
          submission_status_type sst
        ON
          ss.submission_status_type_id = sst.submission_status_type_id
        ORDER BY
          ss.submission_id, ss.submission_status_id DESC) t1
      ON
        t1.submission_id = s.submission_id;
    `;

    const response = await this.connection.sql<ISubmissionModelWithStatus>(sqlStatement);

    return response.rows;
  }

  /**
   * Fetch a submission source transform record by associated source system user id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISourceTransformModel>}
   * @memberof SubmissionRepository
   */
  async getSourceTransformRecordBySubmissionId(submissionId: number): Promise<ISourceTransformModel> {
    const sqlStatement = SQL`
          SELECT
            *
          FROM
            source_transform st
          LEFT JOIN
            submission s
          ON
            st.source_transform_id = s.source_transform_id
          WHERE
            s.submission_id = ${submissionId};
        `;

    const response = await this.connection.sql<ISourceTransformModel>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission source transform record', [
        'SubmissionRepository->getSourceTransformRecordBySubmissionId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update darwin_core_source field in submission table
   *
   * @param {number} submissionId
   * @param {string} normalizedData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionRepository
   */
  async updateSubmissionRecordDWCSource(
    submissionId: number,
    normalizedData: string
  ): Promise<{ submission_id: number }> {
    const sqlStatement = SQL`
      UPDATE
        submission
      SET
        darwin_core_source = ${normalizedData}
      WHERE
        submission_id = ${submissionId}
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission record darwin core source', [
        'SubmissionRepository->updateSubmissionRecordDWCSource',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}
