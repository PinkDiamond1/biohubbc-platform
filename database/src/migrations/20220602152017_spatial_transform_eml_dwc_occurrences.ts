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

    insert into spatial_transform (name, description, record_effective_date, transform) values ('DwC Occurrences', 'Extracts occurrences and properties from DwC JSON source.', now(), $transform$with submission as (select * from submission where submission_id = ?)
, occurrences as (select uuid, occs from submission, jsonb_path_query(darwin_core_source, '$.occurrence') occs)
, occurrence as (select uuid, jsonb_array_elements(occs) occ from occurrences)
, events as (select evns from submission, jsonb_path_query(darwin_core_source, '$.event') evns)
, event as (select jsonb_array_elements(evns) evn from events)
, event_coord as (select st_x(pt) x, st_y(pt) y, evn from event, ST_Transform(ST_SetSRID(ST_MakePoint(split_part(evn->>'verbatimCoordinates', ' ', 2)::integer, split_part(evn->>'verbatimCoordinates', ' ', 3)::integer), split_part(evn->>'verbatimCoordinates', ' ', 1)::integer+32600), 4326) pt)
, taxons as (select taxns from submission, jsonb_path_query(darwin_core_source, '$.taxon') taxns)
, taxon as (select jsonb_array_elements(taxns) taxn from taxons)
, normal as (select distinct o.uuid, o.occ, e.*, t.taxn from occurrence o
	left join event_coord e on (e.evn->'id' = o.occ->'id')
	left outer join taxon t on (t.taxn->'occurrenceID' = o.occ->'occurrenceID'))
select jsonb_build_object('type', 'FeatureCollection'
	, 'features', jsonb_build_array(jsonb_build_object('type', 'Feature'
		, 'geometry', jsonb_build_object('type', 'Point', 'coordinates', json_build_array(n.x, n.y))
		, 'properties', jsonb_build_object('type', 'Occurrence', 'dwc', jsonb_build_object('type', 'PhysicalObject'
			, 'basisOfRecord', 'Occurrence'
			, 'datasetID', n.uuid
			, 'occurrenceID', n.occ->'occurrenceID'
			, 'sex', n.occ->'sex'
			, 'lifeStage', n.occ->'lifeStage'
			, 'associatedTaxa', n.occ->'associatedTaxa'
			, 'individualCount', n.occ->'individualCount'
			, 'eventDate', n.evn->'eventDate'
			, 'verbatimSRS', n.evn->'verbatimSRS'
			, 'verbatimCoordinates', n.evn->'verbatimCoordinates'
			, 'vernacularName', n.taxn->'vernacularName'))))
) result_data from normal n;$transform$);

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
