import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;
const DB_SCHEMA_DAPI_V1 = process.env.DB_SCHEMA_DAPI_V1;

/**
 * Add `survey.surveyed_all_areas` column and update `survey` view.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    SET SCHEMA '${DB_SCHEMA}';
    SET SEARCH_PATH = ${DB_SCHEMA}, ${DB_SCHEMA_DAPI_V1};

    insert into spatial_transform (name, description, record_effective_date, transform) values ('EML Study Boundaries', 'Extracts study boundaries and properties from EML JSON source.', now(), $transform$with submissions as (select eml_json_source from submission where submission_id = ?) 
, coverages as (select c.cov_n, c.coverage from submissions, jsonb_path_query(eml_json_source, '$.**.geographicCoverage') with ordinality c(coverage, cov_n))
, descriptions as (select cov_n, coverage->'geographicDescription' description from coverages)
, polys as (select c.cov_n, p.poly_n, p.points points from coverages c, jsonb_path_query(coverage, '$.**.datasetGPolygon[*].datasetGPolygonOuterGRing.gRingPoint') with ordinality p(points, poly_n))
, latlongs as (select p.cov_n, p.poly_n, arr.point_n, arr.point->>'gRingLatitude' lat, arr.point->>'gRingLongitude' long from polys p, jsonb_array_elements(points) with ordinality arr(point, point_n))
, points as (select ll.cov_n, ll.poly_n, ll.point_n, json_build_array(ll.long::float, ll.lat::float) point from latlongs ll)
, polys2 as (select cov_n, poly_n, jsonb_agg(point order by point_n) poly from points group by cov_n, poly_n)
, multipoly as (select cov_n, jsonb_agg(poly) mpoly from polys2 group by cov_n)
, features as (select json_build_object('type','Feature','geometry', json_build_object('type','Polygon','coordinates', f.mpoly), 'properties', json_build_object('description', f.description)) feature from (select d.description, m.mpoly from multipoly m, descriptions d where d.cov_n = m.cov_n) f)
select json_build_object('type','FeatureCollection','features',jsonb_agg(feature)) from features$transform$);

  `);
}

/**
 * Not used.
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(``);
}
