import { IDBConnection } from '../database/db';
import {
  IInsertSubmissionRecord,
  ISubmissionModel,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { DBService } from './db-service';
export class SubmissionService extends DBService {
  submissionRepository: SubmissionRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.submissionRepository = new SubmissionRepository(connection);
  }

  /**
   * Insert a new submission record.
   *
   * @param {IInsertSubmissionRecord} submissionData
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecord(submissionData: IInsertSubmissionRecord): Promise<{ submission_id: number }> {
    return this.submissionRepository.insertSubmissionRecord(submissionData);
  }

  /**
   * Update the `input_key` column of a submission record.
   *
   * @param {number} submissionId
   * @param {IInsertSubmissionRecord['input_key']} inputKey
   * @return {*}  {Promise<{ submission_id: number }>}
   * @memberof SubmissionService
   */
  async updateSubmissionRecordInputKey(
    submissionId: number,
    inputKey: IInsertSubmissionRecord['input_key']
  ): Promise<{ submission_id: number }> {
    return this.submissionRepository.updateSubmissionRecordInputKey(submissionId, inputKey);
  }

  /**
   * Get submission record by id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<ISubmissionModel>}
   * @memberof SubmissionService
   */
  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<ISubmissionModel> {
    return this.submissionRepository.getSubmissionRecordBySubmissionId(submissionId);
  }

  /**
   * Insert a submission status record.
   *
   * @param {number} submissionId
   * @param {SUBMISSION_STATUS_TYPE} submissionStatusType
   * @return {*}  {Promise<{
   *     submission_status_id: number;
   *     submission_status_type_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionStatus(
    submissionId: number,
    submissionStatusType: SUBMISSION_STATUS_TYPE
  ): Promise<{
    submission_status_id: number;
    submission_status_type_id: number;
  }> {
    return this.submissionRepository.insertSubmissionStatus(submissionId, submissionStatusType);
  }

  /**
   * Insert a submission message record.
   *
   * @param {number} submissionStatusId
   * @param {SUBMISSION_MESSAGE_TYPE} submissionMessageType
   * @return {*}  {Promise<{
   *     submission_message_id: number;
   *     submission_message_type_id: number;
   *   }>}
   * @memberof SubmissionService
   */
  async insertSubmissionMessage(
    submissionStatusId: number,
    submissionMessageType: SUBMISSION_MESSAGE_TYPE
  ): Promise<{
    submission_message_id: number;
    submission_message_type_id: number;
  }> {
    return this.submissionRepository.insertSubmissionMessage(submissionStatusId, submissionMessageType);
  }
}