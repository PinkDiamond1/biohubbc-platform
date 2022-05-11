import { Feature } from 'geojson';
import SQL, { SQLStatement } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ILatLong, IUTM, parseLatLongString, parseUTMString } from '../utils/spatial-utils';
import { BaseRepository } from './base-repository';

export interface IGetOccurrenceData {
  occurrenceId: number;
  submissionId: number;
  taxonId: string | null;
  lifeStage: string | null;
  sex: string | null;
  eventDate: string | null; //TODO is this a timeStamp?
  vernacularName: string | null;
  individualCount: number | null;
  organismQuantity: number | null;
  organismQuantityType: string | null;
  geometry: Feature | null;
}

export interface IPostOccurrenceData {
  associatedTaxa: string | null | undefined;
  lifeStage: string | null | undefined;
  sex: string | null | undefined;
  verbatimCoordinates: string | null | undefined;
  individualCount: string | null | undefined;
  vernacularName: string | null | undefined;
  organismQuantity: string | null | undefined;
  organismQuantityType: string | null | undefined;
  eventDate: string | null | undefined;
}

/**
 * A repository class for accessing occurrence data.
 *
 * @export
 * @class OccurrenceRepository
 * @extends {BaseRepository}
 */
export class OccurrenceRepository extends BaseRepository {
  /**
   * Upload scraped occurrence data.
   *
   * @param {number} submissionId
   * @param {PostOccurrence} scrapedOccurrence
   * @memberof OccurrenceService
   */
  async insertScrapedOccurrence(
    submissionId: number,
    scrapedOccurrence: IPostOccurrenceData
  ): Promise<{ occurrence_id: number }> {
    const sqlStatement: SQLStatement = SQL`
      INSERT INTO occurrence (
        submission_id,
        taxonid,
        lifestage,
        sex,
        vernacularname,
        eventdate,
        individualcount,
        organismquantity,
        organismquantitytype,
        geography
      ) VALUES (
        ${submissionId},
        ${scrapedOccurrence.associatedTaxa},
        ${scrapedOccurrence.lifeStage},
        ${scrapedOccurrence.sex},
        ${scrapedOccurrence.vernacularName},
        ${scrapedOccurrence.eventDate},
        ${scrapedOccurrence.individualCount},
        ${scrapedOccurrence.organismQuantity},
        ${scrapedOccurrence.organismQuantityType}
    `;

    const utm = parseUTMString(scrapedOccurrence.verbatimCoordinates || '');
    const latLong = parseLatLongString(scrapedOccurrence.verbatimCoordinates || '');

    if (utm) {
      // transform utm string into point, if it is not null
      sqlStatement.append(',');
      sqlStatement.append(this.getGeographySqlFromUtm(utm));
    } else if (latLong) {
      // transform latLong string into point, if it is not null
      sqlStatement.append(',');
      sqlStatement.append(this.getGeographySqlFromLatLong(latLong));
    } else {
      // insert null geography
      sqlStatement.append(',');
      sqlStatement.append('null');
    }

    sqlStatement.append(`
      );
    `);

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert occurrence record');
    }

    return response.rows[0];
  }

  getGeographySqlFromUtm(utm: IUTM): SQLStatement {
    return SQL`
      public.ST_Transform(
        public.ST_SetSRID(
          public.ST_MakePoint(${utm.easting}, ${utm.northing}),
          ${utm.zone_srid}
        ),
        4326
      )`;
  }

  getGeographySqlFromLatLong(latLong: ILatLong): SQLStatement {
    return SQL`
      public.ST_Transform(
        public.ST_SetSRID(
          public.ST_MakePoint(${latLong.long}, ${latLong.lat}),
          4326
        ),
        4326
      )`;
  }

  /**
   * Get Occurrence row associated to occurrence Id.
   *
   * @param {number} occurrenceId
   * @return {*}  {Promise<GetOccurrencesViewData>}
   * @memberof OccurrenceRepository
   */
  async getOccurrenceSubmission(occurrenceId: number): Promise<IGetOccurrenceData> {
    const sqlStatement = SQL`
      SELECT
        o.occurrence_id,
        o.submission_id,
        o.occurrenceid,
        o.taxonid,
        o.lifestage,
        o.sex,
        o.vernacularname,
        o.eventdate,
        o.individualcount,
        o.organismquantity,
        o.organismquantitytype,
        public.ST_asGeoJSON(o.geography) as geometry
      FROM
        occurrence as o
      LEFT OUTER JOIN
        occurrence_submission as os
      ON
        o.occurrence_submission_id = os.occurrence_submission_id
      WHERE
        o.occurrence_submission_id = ${occurrenceId}
      AND
        os.delete_timestamp is null;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get occurrence record');
    }

    return response.rows[0];
  }
}
