import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import {
  IInsertSubmissionRecord,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from './submission-repository';
import * as spatialUtils from '../utils/spatial-utils';
import SQL from 'sql-template-strings';

chai.use(sinonChai);

describe('SubmissionRepository', () => {
  describe('insertSubmissionRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return all submission_ids when no criteria is given', async () => {
      const mockQueryResponse = ({ rows: [{ submission_id: 1 }] } as any) as Promise<QueryResult<any>>;

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
      const mockQueryResponse = ({ rows: [{ submission_id: 1 }] } as any) as Promise<QueryResult<any>>;

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
      const mockQueryResponse = ({ rows: [{ submission_id: 1 }] } as any) as Promise<QueryResult<any>>;

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
      source: 'test',
      input_file_name: 'test',
      input_key: 'test',
      event_timestamp: 'test',
      eml_source: 'test',
      darwin_core_source: 'test',
      uuid: 'test'
    };

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionRecord((mockParams as unknown) as IInsertSubmissionRecord);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = ({ rowCount: 1, rows: [{ submission_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionRecord(
        (mockParams as unknown) as IInsertSubmissionRecord
      );

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('updateSubmissionRecordInputKey', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
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
      const mockQueryResponse = ({ rowCount: 1, rows: [{ submission_id: 1 }] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionRecordInputKey(1, 'test');

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('getSubmissionRecordBySubmissionId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
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
        source: 'test',
        input_file_name: 'test',
        input_key: 'test',
        event_timestamp: 'test',
        eml_source: 'test',
        darwin_core_source: 'test',
        uuid: 'test'
      };
      const mockQueryResponse = ({ rowCount: 1, rows: [mockResponse] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionRecordBySubmissionId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getSourceTransformRecordBySystemUserId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSourceTransformRecordBySystemUserId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission source transform record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        source_transform_id: 1
      };

      const mockQueryResponse = ({ rowCount: 1, rows: [mockResponse] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySystemUserId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionStatus', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionStatus(1, SUBMISSION_STATUS_TYPE.SUBMITTED);
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
      const mockQueryResponse = ({ rowCount: 1, rows: [mockResponse] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionStatus(1, SUBMISSION_STATUS_TYPE.SUBMITTED);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionMessage', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = ({ rowCount: 0 } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionMessage(1, SUBMISSION_MESSAGE_TYPE.INVALID_VALUE);
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
      const mockQueryResponse = ({ rowCount: 1, rows: [mockResponse] } as any) as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionMessage(1, SUBMISSION_MESSAGE_TYPE.INVALID_VALUE);

      expect(response).to.eql(mockResponse);
    });
  });
});
