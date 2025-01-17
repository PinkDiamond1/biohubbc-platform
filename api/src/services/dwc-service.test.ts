import { Client } from '@elastic/elasticsearch';
import { WriteResponseBase } from '@elastic/elasticsearch/lib/api/types';
import { GetObjectOutput, ManagedUpload } from 'aws-sdk/clients/s3';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
import {
  ISourceTransformModel,
  ISubmissionModel,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import { IStyleModel } from '../repositories/validation-repository';
import { ElasticSearchIndices } from '../services/es-service';
import * as fileUtils from '../utils/file-utils';
import { CSVWorksheet, ICsvState } from '../utils/media/csv/csv-file';
import * as dwcUtils from '../utils/media/dwc/dwc-archive-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, IMediaState, MediaFile } from '../utils/media/media-file';
import * as mediaUtils from '../utils/media/media-utils';
import { UnknownMedia } from '../utils/media/media-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { DarwinCoreService } from './dwc-service';
import { ESService } from './es-service';
import { SpatialService } from './spatial-service';
import { SubmissionService } from './submission-service';
import { ValidationService } from './validation-service';

chai.use(sinonChai);

describe('DarwinCoreService', () => {
  describe('prepDWCArchive', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when media is invalid or empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns(null);

      try {
        await darwinCoreService.prepDWCArchive('test' as unknown as UnknownMedia);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to parse submission');
      }
    });

    it('should throw an error when media is not a valid DwC Archive File', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns('test' as unknown as MediaFile);

      try {
        await darwinCoreService.prepDWCArchive('test' as unknown as UnknownMedia);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to parse submission');
      }
    });

    it('should succeed', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const archiveStub = sinon.createStubInstance(ArchiveFile);
      const dwcStub = sinon.createStubInstance(DWCArchive);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns(archiveStub);
      const dwcAStub = sinon.stub(dwcUtils, 'DWCArchive').returns(dwcStub);

      const response = await darwinCoreService.prepDWCArchive('test' as unknown as UnknownMedia);

      expect(response).to.equal(dwcStub);
      expect(dwcAStub).to.be.calledOnce;
    });
  });

  describe('ingestNewDwCADataPackage', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const mockArchiveFile = {
        rawFile: {
          fileName: 'test'
        },
        eml: {
          buffer: Buffer.from('test')
        }
      };

      const prepDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'prepDWCArchive')
        .returns(mockArchiveFile as unknown as DWCArchive);
      const insertSubmissionRecordStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecord')
        .resolves({ submission_id: 1 });
      const getSourceTransformRecordBySystemUserIdStub = sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySystemUserId')
        .resolves({ source_transform_id: 1 } as unknown as ISourceTransformModel);

      const response = await darwinCoreService.ingestNewDwCADataPackage(
        { originalname: 'name' } as unknown as Express.Multer.File,
        'string'
      );

      expect(response).to.eql({ dataPackageId: 'string', submissionId: 1 });
      expect(prepDWCArchiveStub).to.be.calledOnce;
      expect(insertSubmissionRecordStub).to.be.calledOnce;
      expect(getSourceTransformRecordBySystemUserIdStub).to.be.calledOnce;
    });
  });

  describe('transformAndUploadMetaData', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if there is no source_transform_id in the submission record', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ id: 1 } as unknown as ISubmissionModel);

      try {
        await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('The source_transform_id is not available');
      }
    });

    it('throws an error if there is no metadata_transform in the source transform record', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 2,
        eml_source: 'some eml source'
      } as unknown as ISubmissionModel);

      sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySourceTransformId')
        .resolves({ source_transform_id: 2 } as unknown as ISourceTransformModel);

      try {
        await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('The source metadata transform is not available');
      }
    });

    it('throws an error if the transformed metadata is null or empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 2,
        eml_source: 'some eml source'
      } as unknown as ISubmissionModel);

      sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySourceTransformId')
        .resolves({ source_transform_id: 2, metadata_transform: 'some transform' } as unknown as ISourceTransformModel);

      sinon.stub(SubmissionService.prototype, 'getSubmissionMetadataJson').resolves('');

      try {
        await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('The source metadata json is not available');
      }
    });

    it('successfully inserts a record into elastic search', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 2,
        eml_source: 'some eml source'
      } as unknown as ISubmissionModel);

      sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySourceTransformId')
        .resolves({ source_transform_id: 2, metadata_transform: 'some transform' } as unknown as ISourceTransformModel);

      sinon.stub(SubmissionService.prototype, 'getSubmissionMetadataJson').resolves('transformed metadata');

      const uploadToElasticSearchStub = sinon
        .stub(DarwinCoreService.prototype, 'uploadToElasticSearch')
        .resolves('success response' as unknown as WriteResponseBase);

      await darwinCoreService.transformAndUploadMetaData(1, 'dataPackageId');

      expect(uploadToElasticSearchStub).to.be.calledOnceWith('dataPackageId', 'transformed metadata');
    });
  });

  describe('convertSubmissionEMLtoJSON', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('transforms a submission record eml (xml) to json', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const mediaFileStub = sinon.createStubInstance(MediaFile);
      const bufferStub = sinon.createStubInstance(Buffer);

      bufferStub.toString.returns(
        '<?xml version="1.0" encoding="UTF-8"?><eml:eml packageId="urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f"></eml:eml>'
      );

      mediaFileStub.buffer = bufferStub as unknown as Buffer;

      const mockDWCAFile = {
        submission_id: 1,
        eml: {
          emlFile: mediaFileStub
        }
      };

      const getSubmissionRecordBySubmissionIdStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(mockDWCAFile as unknown as DWCArchive);

      const updateSubmissionRecordEMLJSONSourceStub = sinon
        .stub(SubmissionService.prototype, 'updateSubmissionRecordEMLJSONSource')
        .resolves();

      const response = await darwinCoreService.convertSubmissionEMLtoJSON(1);

      expect(response).to.eql({
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        'eml:eml': { '@_packageId': 'urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f' }
      });
      expect(getSubmissionRecordBySubmissionIdStub).to.have.been.calledOnceWith(1);
      expect(updateSubmissionRecordEMLJSONSourceStub).to.have.been.calledOnceWith(1, {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        'eml:eml': { '@_packageId': 'urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f' }
      });
    });
  });

  describe('validateSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw api general error if validation fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves({} as unknown as DWCArchive);
      sinon.stub(ValidationService.prototype, 'getStyleSchemaByStyleId').resolves({} as unknown as IStyleModel);
      sinon
        .stub(ValidationService.prototype, 'validateDWCArchiveWithStyleSchema')
        .resolves({ validation: false, mediaState: {} as unknown as IMediaState });

      try {
        await darwinCoreService.validateSubmission(1, 1);

        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Validation failed');
      }
    });

    it('should set submission status to DWC validated', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves({} as unknown as DWCArchive);
      sinon.stub(ValidationService.prototype, 'getStyleSchemaByStyleId').resolves({} as unknown as IStyleModel);
      sinon.stub(ValidationService.prototype, 'validateDWCArchiveWithStyleSchema').resolves({
        validation: true,
        mediaState: {} as unknown as IMediaState,
        csvState: {} as unknown as ICsvState
      });

      const response = await darwinCoreService.validateSubmission(1, 1);

      expect(response).to.eql({
        validation: true,
        mediaState: {} as unknown as IMediaState,
        csvState: {} as unknown as ICsvState
      });
    });
  });

  describe('uploadToElasticSearch', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('succeeds with valid values', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const indexStub = sinon.stub().returns('es response');

      sinon.stub(DarwinCoreService.prototype, 'getEsClient').resolves({
        index: indexStub
      } as unknown as Client);

      const response = await darwinCoreService.uploadToElasticSearch('dataPackageId', 'convertedEML');

      expect(indexStub).to.be.calledOnceWith({
        id: 'dataPackageId',
        index: ElasticSearchIndices.EML,
        document: 'convertedEML'
      });
      expect(response).equals('es response');
    });
  });

  describe('normalizeSubmissionDWCA', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should set submission status to ingested', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const inputParams = { test: 'test' } as unknown as DWCArchive;

      sinon.stub(DarwinCoreService.prototype, 'normalizeDWCA').returns('validstring');

      const updateSubmissionRecordDWCSourceStub = sinon
        .stub(SubmissionService.prototype, 'updateSubmissionRecordDWCSource')
        .resolves({ submission_id: 1 });

      await darwinCoreService.normalizeSubmissionDWCA(1, inputParams);

      expect(updateSubmissionRecordDWCSourceStub).to.be.calledOnceWith(1, 'validstring');
    });
  });

  describe('uploadRecordToS3', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should set submission status to ingested', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      sinon.stub(fileUtils, 'generateS3FileKey').returns('s3Key');

      sinon.stub(SubmissionService.prototype, 'updateSubmissionRecordInputKey').resolves();

      const uploadFileToS3Stub = sinon
        .stub(fileUtils, 'uploadFileToS3')
        .resolves({ Key: 's3Key' } as unknown as ManagedUpload.SendData);

      const response = await darwinCoreService.uploadRecordToS3(1, multerFile);

      expect(uploadFileToS3Stub).to.be.calledOnceWith(multerFile, 's3Key', {
        filename: 'file1.txt'
      });
      expect(response).to.eql({ s3Key: 's3Key' });
    });
  });

  describe('normalizeDWCA', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should normalize dwca and return json string', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const inputParams = {
        worksheets: {
          test1: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet,
          test2: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet
        }
      } as unknown as DWCArchive;

      const normailizedInputParams = {
        test1: [
          { id: 1, name: 'test' },
          { id: 2, name: 'test' }
        ],
        test2: [
          { id: 1, name: 'test' },
          { id: 2, name: 'test' }
        ]
      };

      const jsonNormalized = JSON.stringify(normailizedInputParams);

      const response = await darwinCoreService.normalizeDWCA(inputParams);

      expect(response).to.eql(jsonNormalized);
    });
  });

  describe('intake', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should replace an existing file if the dataPackageId has previously been submitted', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const getSubmissionStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionIdByUUID')
        .resolves({ submission_id: 1 });

      const deleteSpatialComponentsSpatialTransformRefsBySubmissionIdStub = sinon
        .stub(SpatialService.prototype, 'deleteSpatialComponentsSpatialTransformRefsBySubmissionId')
        .resolves([]);
      const deleteSpatialComponentsSecurityTransformRefsBySubmissionIdStub = sinon
        .stub(SpatialService.prototype, 'deleteSpatialComponentsSecurityTransformRefsBySubmissionId')
        .resolves([]);
      const deleteSpatialComponentsStub = sinon
        .stub(SpatialService.prototype, 'deleteSpatialComponentsBySubmissionId')
        .resolves([]);

      const submissionEndDateStub = sinon
        .stub(SubmissionService.prototype, 'setSubmissionEndDateById')
        .resolves({ submission_id: 1 });

      const createStub = sinon.stub(DarwinCoreService.prototype, 'create').resolves();

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      await darwinCoreService.intake(multerFile, 'dataPackageId');
      expect(getSubmissionStub).to.be.calledWith('dataPackageId');
      expect(deleteSpatialComponentsSpatialTransformRefsBySubmissionIdStub).to.be.calledWith(1);
      expect(deleteSpatialComponentsSecurityTransformRefsBySubmissionIdStub).to.be.calledWith(1);
      expect(deleteSpatialComponentsStub).to.be.calledWith(1);
      expect(submissionEndDateStub).to.be.calledWith(1);
      expect(createStub).to.be.calledOnceWith(multerFile, 'dataPackageId');
    });

    it('should create a new submission if the dataPackageId has not previously been submitted', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const getSubmissionStub = sinon.stub(SubmissionService.prototype, 'getSubmissionIdByUUID').resolves();

      const submissionEndDateStub = sinon
        .stub(SubmissionService.prototype, 'setSubmissionEndDateById')
        .resolves({ submission_id: 1 });

      const createStub = sinon.stub(DarwinCoreService.prototype, 'create').resolves();

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      await darwinCoreService.intake(multerFile, 'dataPackageId');
      expect(getSubmissionStub).to.be.calledWith('dataPackageId');
      expect(submissionEndDateStub).not.to.be.called;
      expect(createStub).to.be.calledOnceWith(multerFile, 'dataPackageId');
    });
  });

  describe('create', () => {
    afterEach(() => {
      sinon.restore();
    });
    it('should set submission status', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      const ingestDWCStub = sinon.stub(DarwinCoreService.prototype, 'create_step1_ingestDWC').resolves(1);

      const uploadStub = sinon.stub(DarwinCoreService.prototype, 'create_step2_uploadRecordToS3').resolves();
      const validateStub = sinon.stub(DarwinCoreService.prototype, 'create_step3_validateSubmission').resolves();
      const ingestEMLStub = sinon.stub(DarwinCoreService.prototype, 'create_step4_ingestEML').resolves();
      const convertEMLToJSONStub = sinon.stub(DarwinCoreService.prototype, 'create_step5_convertEMLToJSON').resolves();
      const spatialTransformStub = sinon
        .stub(DarwinCoreService.prototype, 'create_step6_transformAndUploadMetaData')
        .resolves();
      const normalizeStub = sinon.stub(DarwinCoreService.prototype, 'create_step7_normalizeSubmissionDWCA').resolves();

      const runSpatialTransformsStub = sinon
        .stub(DarwinCoreService.prototype, 'create_step8_runSpatialTransforms')
        .resolves();
      const runSecurityTransformsStub = sinon
        .stub(DarwinCoreService.prototype, 'create_step9_runSecurityTransforms')
        .resolves();

      await darwinCoreService.create(multerFile, 'dataPackageId');

      expect(ingestDWCStub).to.be.calledWith(multerFile, 'dataPackageId');
      expect(uploadStub).to.be.calledWith(1);
      expect(validateStub).to.be.calledWith(1);
      expect(ingestEMLStub).to.be.calledWith(1);
      expect(convertEMLToJSONStub).to.be.calledWith(1);
      expect(spatialTransformStub).to.be.calledWith(1);
      expect(normalizeStub).to.be.calledWith(1);
      expect(runSpatialTransformsStub).to.be.calledWith(1);
      expect(runSecurityTransformsStub).to.be.calledWith(1);
    });

    it('should throw an error if step1 does not returns a submissionId', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const multerFile = {
        originalname: 'file1.txt',
        buffer: Buffer.from('file1data')
      } as unknown as Express.Multer.File;

      const ingestDWCStub = sinon
        .stub(DarwinCoreService.prototype, 'create_step1_ingestDWC')
        .resolves(null as unknown as number);
      const uploadStub = sinon.stub(DarwinCoreService.prototype, 'create_step2_uploadRecordToS3').resolves();

      try {
        await darwinCoreService.create(multerFile, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect(ingestDWCStub).to.be.calledWith(multerFile, 'dataPackageId');
        expect((actualError as ApiGeneralError).message).to.equal('The Darwin Core submission could not be processed');
        expect(uploadStub).to.not.be.called;
      }
    });
  });

  describe('create_step1_ingestDWC', () => {
    afterEach(() => {
      sinon.restore();
    });

    const multerFile = {
      originalname: 'file1.txt',
      buffer: Buffer.from('file1data')
    } as unknown as Express.Multer.File;
    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestDWCStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: 'dataPackageId', submissionId: 1 });
      const insertSubmissionRecordStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      const response = await darwinCoreService.create_step1_ingestDWC(multerFile, 'dataPackageId');
      expect(ingestDWCStub).to.be.calledOnce;
      expect(ingestDWCStub).to.be.calledWith(multerFile, 'dataPackageId');

      expect(response).to.eql(1);
      expect(insertSubmissionRecordStub).to.be.calledOnce;
    });

    it('should throw an error when ingestion fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestDWCStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCADataPackage')
        .resolves({ dataPackageId: 'abcd', submissionId: 1 });

      try {
        await darwinCoreService.create_step1_ingestDWC(multerFile, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect(ingestDWCStub).to.be.calledWith(multerFile, 'dataPackageId');
        expect((actualError as ApiGeneralError).message).to.equal('Ingestion failed');
      }
    });
  });

  describe('create_step2_uploadRecordToS3', () => {
    afterEach(() => {
      sinon.restore();
    });

    const multerFile = {
      originalname: 'file1.txt',
      buffer: Buffer.from('file1data')
    } as unknown as Express.Multer.File;

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const uploadStub = sinon.stub(DarwinCoreService.prototype, 'uploadRecordToS3').resolves();
      const insertSubmissionStatusStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await darwinCoreService.create_step2_uploadRecordToS3(1, multerFile);

      expect(uploadStub).to.be.calledOnce;
      expect(uploadStub).to.be.calledWith(1, multerFile);
      expect(insertSubmissionStatusStub).to.be.calledWith(1, SUBMISSION_STATUS_TYPE.UPLOADED);
    });

    it('should throw an error when uploading record to s3 fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const uploadRecordToS3Stub = sinon
        .stub(DarwinCoreService.prototype, 'uploadRecordToS3')
        .throws(new ApiGeneralError('error'));

      try {
        await darwinCoreService.create_step2_uploadRecordToS3(1, multerFile);
        expect.fail();
      } catch (actualError) {
        expect(uploadRecordToS3Stub).to.have.been.calledOnceWith(1, multerFile);
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_UPLOAD,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });
  });

  describe('create_step3_validateSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const validateStub = sinon.stub(DarwinCoreService.prototype, 'tempValidateSubmission').resolves();
      const insertSubmissionStatusStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await darwinCoreService.create_step3_validateSubmission(1);

      expect(validateStub).to.be.calledOnce;
      expect(validateStub).to.be.calledWith(1);
      expect(insertSubmissionStatusStub).to.be.calledWith(1, SUBMISSION_STATUS_TYPE.VALIDATED);
    });

    it('should throw an error when validation fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const validateStub = sinon
        .stub(DarwinCoreService.prototype, 'tempValidateSubmission')
        .throws(new ApiGeneralError('error'));

      try {
        await darwinCoreService.create_step3_validateSubmission(1);
        expect.fail();
      } catch (actualError) {
        expect(validateStub).to.have.been.calledOnceWith(1);
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_VALIDATION,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });
  });

  describe('create_step4_ingestEML', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const ingestNewDWCStub = sinon.stub(DarwinCoreService.prototype, 'ingestNewDwCAEML').resolves();
      const insertSubmissionStatusStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await darwinCoreService.create_step4_ingestEML(1);

      expect(ingestNewDWCStub).to.be.calledOnce;
      expect(ingestNewDWCStub).to.be.calledWith(1);
      expect(insertSubmissionStatusStub).to.be.calledWith(1, SUBMISSION_STATUS_TYPE.EML_INGESTED);
    });

    it('should throw an error EML ingestion fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const ingestNewDWCStub = sinon
        .stub(DarwinCoreService.prototype, 'ingestNewDwCAEML')
        .throws(new ApiGeneralError('error'));

      try {
        await darwinCoreService.create_step4_ingestEML(1);
        expect.fail();
      } catch (actualError) {
        expect(ingestNewDWCStub).to.have.been.calledOnceWith(1);
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_EML_INGESTION,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });
  });

  describe('create_step5_convertEMLToJSON', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const convertEMLtoJSONStub = sinon.stub(DarwinCoreService.prototype, 'convertSubmissionEMLtoJSON').resolves();
      const insertSubmissionStatusStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await darwinCoreService.create_step5_convertEMLToJSON(1);

      expect(convertEMLtoJSONStub).to.be.calledOnce;
      expect(convertEMLtoJSONStub).to.be.calledWith(1);
      expect(insertSubmissionStatusStub).to.be.calledWith(1, SUBMISSION_STATUS_TYPE.EML_TO_JSON);
    });

    it('should throw an error when converting EML to JSON fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const convertEMLtoJSONStub = sinon
        .stub(DarwinCoreService.prototype, 'convertSubmissionEMLtoJSON')
        .throws(new ApiGeneralError('error'));

      try {
        await darwinCoreService.create_step5_convertEMLToJSON(1);
        expect.fail();
      } catch (actualError) {
        expect(convertEMLtoJSONStub).to.have.been.calledOnceWith(1);
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_EML_TO_JSON,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });
  });

  describe('create_step6_transformAndUploadMetaData', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const transformStub = sinon.stub(DarwinCoreService.prototype, 'transformAndUploadMetaData').resolves();
      const insertSubmissionStatusStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await darwinCoreService.create_step6_transformAndUploadMetaData(1, 'dataPackageId');

      expect(transformStub).to.be.calledOnce;
      expect(transformStub).to.be.calledWith(1);
      expect(insertSubmissionStatusStub).to.be.calledWith(1, SUBMISSION_STATUS_TYPE.METADATA_TO_ES);
    });

    it('should throw an error when transform and upload metadata fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const transformStub = sinon
        .stub(DarwinCoreService.prototype, 'transformAndUploadMetaData')
        .throws(new ApiGeneralError('error'));

      try {
        await darwinCoreService.create_step6_transformAndUploadMetaData(1, 'dataPackageId');
        expect.fail();
      } catch (actualError) {
        expect(transformStub).to.have.been.calledOnceWith(1);
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_METADATA_TO_ES,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });
  });

  describe('create_step7_normalizeSubmissionDWCA', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const dwcaStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves({ rawFile: { fileName: 'file' } } as unknown as DWCArchive);
      const normalizeStub = sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').resolves();
      const insertSubmissionStatusStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await darwinCoreService.create_step7_normalizeSubmissionDWCA(1);

      expect(dwcaStub).to.be.calledOnce;
      expect(dwcaStub).to.be.calledWith(1);
      expect(normalizeStub).to.be.calledOnce;
      expect(normalizeStub).to.be.calledWith(1, { rawFile: { fileName: 'file' } } as unknown as DWCArchive);
      expect(insertSubmissionStatusStub).to.be.calledWith(1, SUBMISSION_STATUS_TYPE.NORMALIZED);
    });

    it('should throw an error when normalizing the submission fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const dwcaStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves({ rawFile: { fileName: 'file' } } as unknown as DWCArchive);

      const normalizeStub = sinon
        .stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA')
        .throws(new ApiGeneralError('error'));

      try {
        await darwinCoreService.create_step7_normalizeSubmissionDWCA(1);
        expect.fail();
      } catch (actualError) {
        expect(dwcaStub).to.have.been.calledOnceWith(1);
        expect(normalizeStub).to.have.been.calledOnceWith(1, {
          rawFile: { fileName: 'file' }
        } as unknown as DWCArchive);
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_NORMALIZATION,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });

    it('should throw an error when converting the submission to DWCArchive fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const dwcaStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .throws(new ApiGeneralError('error'));

      const normalizeStub = sinon.stub(DarwinCoreService.prototype, 'normalizeSubmissionDWCA').resolves();

      try {
        await darwinCoreService.create_step7_normalizeSubmissionDWCA(1);
        expect.fail();
      } catch (actualError) {
        expect(dwcaStub).to.have.been.calledOnceWith(1);
        expect(normalizeStub).to.not.be.called;
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_NORMALIZATION,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });
  });

  describe('create_step8_runSpatialTransforms', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const spatialTransformStub = sinon.stub(SpatialService.prototype, 'runSpatialTransforms').resolves();
      const insertSubmissionStatusStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await darwinCoreService.create_step8_runSpatialTransforms(1);

      expect(spatialTransformStub).to.be.calledOnce;
      expect(spatialTransformStub).to.be.calledWith(1);
      expect(insertSubmissionStatusStub).to.be.calledWith(1, SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_UNSECURE);
    });

    it('should throw an error when spatial transforms fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const spatialTransformStub = sinon
        .stub(SpatialService.prototype, 'runSpatialTransforms')
        .throws(new ApiGeneralError('error'));

      try {
        await darwinCoreService.create_step8_runSpatialTransforms(1);
        expect.fail();
      } catch (actualError) {
        expect(spatialTransformStub).to.have.been.calledOnceWith(1);
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_UNSECURE,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });
  });

  describe('create_step9_runSecurityTransforms', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const securityTransformStub = sinon.stub(SpatialService.prototype, 'runSecurityTransforms').resolves();
      const insertSubmissionStatusStub = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await darwinCoreService.create_step9_runSecurityTransforms(1);

      expect(securityTransformStub).to.be.calledOnce;
      expect(securityTransformStub).to.be.calledWith(1);
      expect(insertSubmissionStatusStub).to.be.calledWith(1, SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_SECURE);
    });

    it('should throw an error when security transforms fails ', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const insertSubmissionStatusAndMessageStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
        .resolves();

      const secureTransformStub = sinon
        .stub(SpatialService.prototype, 'runSecurityTransforms')
        .throws(new ApiGeneralError('error'));

      try {
        await darwinCoreService.create_step9_runSecurityTransforms(1);
        expect.fail();
      } catch (actualError) {
        expect(secureTransformStub).to.have.been.calledOnceWith(1);
        expect(insertSubmissionStatusAndMessageStub).to.be.calledOnceWith(
          1,
          SUBMISSION_STATUS_TYPE.FAILED_SPATIAL_TRANSFORM_SECURE,
          SUBMISSION_MESSAGE_TYPE.ERROR,
          'error'
        );
      }
    });
  });

  describe('getSubmissionRecordAndConvertToDWCArchive', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const mockArchiveFile = {
        rawFile: {
          fileName: 'test'
        },
        eml: {
          buffer: Buffer.from('test')
        }
      };

      const s3File = {
        Metadata: { filename: 'file1.txt' },
        Body: Buffer.from('file1data')
      } as unknown as GetObjectOutput;

      const getFileStub = sinon.stub(SubmissionService.prototype, 'getIntakeFileFromS3').resolves(s3File);
      const prepDWCStub = sinon.stub(DarwinCoreService.prototype, 'prepDWCArchive').resolves(mockArchiveFile);

      await darwinCoreService.getSubmissionRecordAndConvertToDWCArchive(1);

      expect(getFileStub).to.be.calledOnce;
      expect(getFileStub).to.be.calledWith(1);
      expect(prepDWCStub).to.be.calledOnce;
      expect(prepDWCStub).to.be.calledWith(s3File);
    });

    it('should succeed throw an error when a valid file is not returned', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const getFileStub = sinon
        .stub(SubmissionService.prototype, 'getIntakeFileFromS3')
        .resolves(null as unknown as GetObjectOutput);

      try {
        await darwinCoreService.getSubmissionRecordAndConvertToDWCArchive(1);
        expect.fail();
      } catch (actualError) {
        expect(getFileStub).to.be.calledOnce;
        expect(getFileStub).to.be.calledWith(1);
        expect((actualError as ApiGeneralError).message).to.equal('The source file is not available');
      }
    });
  });

  describe('ingestNewDwCAEML', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid input', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const mockArchiveFile = {
        rawFile: {
          fileName: 'test'
        },
        eml: {
          buffer: Buffer.from('test')
        }
      };

      const getFileStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(mockArchiveFile as unknown as DWCArchive);
      const prepDWCStub = sinon
        .stub(SubmissionService.prototype, 'updateSubmissionRecordEMLSource')
        .resolves({ submission_id: 1 });

      await darwinCoreService.ingestNewDwCAEML(1);

      expect(getFileStub).to.be.calledOnce;
      expect(getFileStub).to.be.calledWith(1);
      expect(prepDWCStub).to.be.calledOnce;
      expect(prepDWCStub).to.be.calledWith(1, mockArchiveFile.eml);
    });

    it('should succeed throw an error when the dwc file returned is not valid', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const getFileStub = sinon
        .stub(DarwinCoreService.prototype, 'getSubmissionRecordAndConvertToDWCArchive')
        .resolves(null as unknown as DWCArchive);
      const prepDWCStub = sinon
        .stub(SubmissionService.prototype, 'updateSubmissionRecordEMLSource')
        .resolves({ submission_id: 1 });

      try {
        await darwinCoreService.ingestNewDwCAEML(1);
        expect.fail();
      } catch (actualError) {
        expect(getFileStub).to.be.calledOnce;
        expect(getFileStub).to.be.calledWith(1);
        expect(prepDWCStub).to.not.be.called;
        expect((actualError as ApiGeneralError).message).to.equal('Converting the record to DWC Archive failed');
      }
    });
  });

  describe('deleteEmlFromElasticSearchByDataPackageId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed and delete old es file', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const esClientStub = sinon.createStubInstance(Client);

      esClientStub.delete.resolves('dataPackageId eml' as unknown as WriteResponseBase);

      const getEsClientStub = sinon
        .stub(ESService.prototype, 'getEsClient')
        .resolves(esClientStub as unknown as Client);

      const response = await darwinCoreService.deleteEmlFromElasticSearchByDataPackageId('dataPackageId');

      expect(getEsClientStub).to.be.calledOnce;
      expect(response).to.equal('dataPackageId eml');
    });
  });
});
