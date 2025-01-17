import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SQL from 'sql-template-strings';
import { ApiGeneralError } from '../errors/api-error';
import { EMLFile } from '../utils/media/eml/eml-file';
import * as spatialUtils from '../utils/spatial-utils';
import { getMockDBConnection } from '../__mocks__/db';
import {
  IInsertSubmissionRecord,
  ISourceTransformModel,
  ISpatialComponentCount,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from './submission-repository';

chai.use(sinonChai);

describe('SubmissionRepository', () => {
  describe('insertSubmissionRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return all submission_ids when no criteria is given', async () => {
      const mockQueryResponse = { rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.findSubmissionByCriteria({});

      expect(response).to.eql([{ submission_id: 1 }]);
    });

    it('should append knex query if keyword is given', async () => {
      const mockQueryResponse = { rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async (query) => {
          const sql = query.toSQL().sql;
          expect(sql).includes('taxonid');
          expect(sql).includes('lifestage');
          expect(sql).includes('sex');
          expect(sql).includes('vernacularname');
          expect(sql).includes('individualcount');
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.findSubmissionByCriteria({ keyword: 'keyword' });

      expect(response).to.eql([{ submission_id: 1 }]);
    });

    it('should append knex query if spatial is given', async () => {
      const mockQueryResponse = { rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => {
          return mockQueryResponse;
        }
      });

      const generateGeoStub = sinon.stub(spatialUtils, 'generateGeometryCollectionSQL').returns(SQL`valid sql`);

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.findSubmissionByCriteria({ spatial: JSON.stringify('spatial') });

      expect(response).to.eql([{ submission_id: 1 }]);
      expect(generateGeoStub).to.be.calledWith('spatial');
    });
  });

  describe('insertSubmissionRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    const mockParams = {
      source_transform_id: 'test',
      input_file_name: 'test',
      input_key: 'test',
      record_effective_date: 'test',
      eml_source: 'test',
      darwin_core_source: 'test',
      uuid: 'test'
    };

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionRecord(mockParams as unknown as IInsertSubmissionRecord);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionRecord(
        mockParams as unknown as IInsertSubmissionRecord
      );

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('updateSubmissionRecordInputKey', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.updateSubmissionRecordInputKey(1, 'test');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to update submission record key');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionRecordInputKey(1, 'test');

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('updateSubmissionRecordEMLSource', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when update sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.updateSubmissionRecordEMLSource(1, {
          emlFile: Buffer.from('')
        } as unknown as EMLFile);

        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to update submission record source');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionRecordEMLSource(1, {
        emlFile: Buffer.from('')
      } as unknown as EMLFile);

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('updateSubmissionRecordEMLJSONSource', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when update sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);
      try {
        await submissionRepository.updateSubmissionRecordEMLJSONSource(1, 'string');

        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to update submission record eml json');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionRecordEMLJSONSource(1, 'string');

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('getSubmissionRecordBySubmissionId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionRecordBySubmissionId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        source_transform_id: 'test',
        input_file_name: 'test',
        input_key: 'test',
        record_effective_date: 'test',
        eml_source: 'test',
        darwin_core_source: 'test',
        uuid: 'test'
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionRecordBySubmissionId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getSubmissionIdByRecordByUUID', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionIdByUUID('test_uuid');

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('getSubmissionRecordEMLJSONByDatasetId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return a query result', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionRecordEMLJSONByDatasetId('111-222-333');

      expect(response).to.equal(mockQueryResponse);
    });
  });

  describe('getSpatialComponentCountByDatasetId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = [{ spatial_type: 'occurrence', count: 10 }] as any as Promise<ISpatialComponentCount[]>;

      const mockDBConnection = getMockDBConnection();
      sinon.stub(SubmissionRepository.prototype, 'getSpatialComponentCountByDatasetId').returns(mockResponse);

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSpatialComponentCountByDatasetId('111-222-333');

      expect(response[0].spatial_type).to.equal('occurrence');
      expect(response[0].count).to.equal(10);
    });

    it('internal function should succeed with valid data', async () => {
      const mockResponse = [{ spatial_type: 'occurrence', count: 10 }] as any as Promise<ISpatialComponentCount[]>;

      const mockDBConnection = getMockDBConnection();
      sinon.stub(SubmissionRepository.prototype, 'getSpatialComponentCountByDatasetId').returns(mockResponse);

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSpatialComponentCountByDatasetId('111-222-333');

      expect(response[0].spatial_type).to.equal('occurrence');
      expect(response[0].count).to.equal(10);
    });

    it('internal function should succeed with valid data as admin', async () => {
      const mockResponse = [{ spatial_type: 'occurrence', count: 10 }] as any as Promise<ISpatialComponentCount[]>;

      const mockDBConnection = getMockDBConnection();
      sinon.stub(SubmissionRepository.prototype, 'getSpatialComponentCountByDatasetIdAsAdmin').returns(mockResponse);

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSpatialComponentCountByDatasetIdAsAdmin('111-222-333');

      expect(response[0].spatial_type).to.equal('occurrence');
      expect(response[0].count).to.equal(10);
    });
  });

  describe('setSubmissionEndDateById', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.setSubmissionEndDateById(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to update end date in submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.setSubmissionEndDateById(1);

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('getSourceTransformRecordBySystemUserId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSourceTransformRecordBySystemUserId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission source transform record');
      }
    });

    it('should succeed with valid data, without optional version parameter', async () => {
      const mockResponse = {
        source_transform_id: 1
      } as unknown as ISourceTransformModel;

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySystemUserId(1);

      expect(response).to.eql(mockResponse);
    });

    it('should succeed with valid data, with optional version parameter', async () => {
      const mockResponse = {
        source_transform_id: 1
      } as unknown as ISourceTransformModel;

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySystemUserId(1, 'v1');

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getSubmissionMetadataJson', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ query: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionMetadataJson(1, 'transform sql');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to transform submission eml to json');
      }
    });

    it('should succeed with valid data, without optional version parameter', async () => {
      const mockResponse = {
        result_data: 'transformed eml'
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ query: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionMetadataJson(1, 'transform sql');

      expect(response).to.eql('transformed eml');
    });
  });

  describe('getSourceTransformRecordBySourceTransformId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSourceTransformRecordBySourceTransformId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission source transform record');
      }
    });

    it('should succeed with valid data, without optional version parameter', async () => {
      const mockResponse = {
        source_transform_id: 1
      } as unknown as ISourceTransformModel;

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySourceTransformId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionStatus', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionStatus(1, SUBMISSION_STATUS_TYPE.INGESTED);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission status record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_status_id: 1,
        submission_status_type_id: 2
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionStatus(1, SUBMISSION_STATUS_TYPE.INGESTED);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionMessage', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionMessage(1, SUBMISSION_MESSAGE_TYPE.ERROR, 'some message');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission message record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_status_id: 1,
        submission_message_type_id: 2
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionMessage(1, SUBMISSION_MESSAGE_TYPE.ERROR, '');

      expect(response).to.eql(mockResponse);
    });
  });

  describe('listSubmissionRecords', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_status: 'Submission Data Ingested',
        submission_id: 1,
        source_transform_id: 'SIMS',
        uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
        record_effective_date: '2022-05-24T18:41:42.211Z',
        delete_timestamp: null,
        input_key: 'platform/1/moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
        input_file_name: 'moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
        eml_source: null,
        eml_json_source: null,
        darwin_core_source: 'test',
        create_date: '2022-05-24T18:41:42.056Z',
        create_user: 15,
        update_date: '2022-05-24T18:41:42.056Z',
        update_user: 15,
        revision_count: 1
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.listSubmissionRecords();

      expect(response).to.eql([mockResponse]);
    });
  });

  describe('getSourceTransformRecordBySubmissionId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSourceTransformRecordBySubmissionId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission source transform record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        source_transform_id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySubmissionId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('updateSubmissionRecordDWCSource', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when update sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.updateSubmissionRecordDWCSource(1, 'string');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to update submission record darwin core source'
        );
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionRecordDWCSource(1, 'string');

      expect(response).to.eql(mockResponse);
    });
  });
});
