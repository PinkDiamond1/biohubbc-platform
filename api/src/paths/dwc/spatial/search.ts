import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { Feature } from 'geojson';
import { getAPIUserDBConnection } from '../../../database/db';
import { GeoJSONFeatureCollection } from '../../../openapi/schemas/geoJson';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SpatialService } from '../../../services/spatial-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/search');

export const GET: Operation = [searchSpatialComponents()];

GET.apiDoc = {
  description: 'Searches for spatial components.',
  tags: ['search'],
  parameters: [
    {
      in: 'query',
      name: 'boundary',
      required: true,
      schema: {
        type: 'string'
      },
      description: 'A stringified GeoJSON Feature. Will return results that intersect the feature.'
    },
    {
      in: 'query',
      name: 'type',
      schema: {
        type: 'array',
        items: {
          type: 'string'
        },
        nullable: true
      },
      description: 'An array of spatial component types to filter on. Will return results that match any of the types.'
    },
    {
      in: 'query',
      name: 'datasetID',
      schema: {
        type: 'array',
        items: {
          type: 'string'
        },
        nullable: true
      },
      description: 'An array of dataset IDs. Will return results that belong to any of the dataset IDs.'
    }
  ],
  responses: {
    200: {
      description: 'Spatial components response object.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: ['submission_spatial_component_id', 'spatial_data'],
              properties: {
                submission_spatial_component_id: {
                  type: 'integer',
                  minimum: 1
                },
                spatial_data: {
                  ...GeoJSONFeatureCollection
                }
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function searchSpatialComponents(): RequestHandler {
  return async (req, res) => {
    const criteria = {
      type: (req.query.type as string[]) || [],
      datasetID: (req.query.datasetID as string[]) || [],
      boundary: JSON.parse(req.query.boundary as string) as Feature
    };

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      const response = await spatialService.findSpatialComponentsByCriteria(criteria);

      await connection.commit();

      res.status(200).json(response.map((item) => item.spatial_component));
    } catch (error) {
      defaultLog.error({ label: 'searchSpatialComponents', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
