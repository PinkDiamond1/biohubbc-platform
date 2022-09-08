import { Box, Button } from '@mui/material';
import simplify from '@turf/simplify';
import { IFormikAreaUpload } from 'components/upload/UploadArea';
import DatasetSearchForm, {
  DatasetSearchFormInitialValues,
  DatasetSearchFormYupSchema,
  IDatasetSearchForm
} from 'features/datasets/components/DatasetSearchForm';
import SearchResultList, { IDatasetVisibility, ISearchResult } from 'features/datasets/components/SearchResultList';
import { Form, Formik, FormikProps } from 'formik';
import { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
import { DataLoader } from 'hooks/useDataLoader';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
import { useRef, useState } from 'react';

export interface IDatasetRequest {
  criteria: {
    boundary: Feature;
    type: string[];
    species?: string[];
    zoom?: number; // TODO include in request params when backend is updated to receive it
    datasetID?: string;
    datasetName?: string;
  };
}

export interface SideSearchBarProps {
  mapDataLoader: DataLoader<
    [
      searchBoundary: Feature<Geometry, GeoJsonProperties>[],
      searchType: string[],
      species?: string[],
      searchZoom?: number,
      datasetID?: string
    ],
    ISpatialData[],
    unknown
  >;
  searchResults: ISearchResult[];
  onAreaUpdate: (area: IFormikAreaUpload[]) => void;
  onToggleDataVisibility: (datasets: IDatasetVisibility) => void;
}

const SideSearchBar: React.FC<SideSearchBarProps> = (props) => {
  const formikRef = useRef<FormikProps<IDatasetSearchForm>>(null);
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState<IDatasetSearchForm | null>(null);
  /**
   * Handle dataset requests.
   */
  const handleDatasetRequestCreation = async (values: IDatasetSearchForm) => {
    const featureArray: Feature[] = [];
    values.area.forEach((area: IFormikAreaUpload) => {
      area.features.forEach((feature: Feature<Polygon>) => {
        const newFeature: Feature = {
          type: 'Feature',
          geometry: simplify(feature.geometry, { tolerance: 0.01, highQuality: false }),
          properties: feature.properties
        };
        featureArray.push(newFeature);
      });
    });

    props.mapDataLoader.refresh(featureArray, [values.dataset], values.species_list);
    setFormData(values);
    toggleForm();
  };

  // //User uploads boundary for search
  // const onAreaUpload = (area: IFormikAreaUpload) => {
  //   //SET BOUNDS
  //   const bounds = calculateUpdatedMapBounds(area.features);
  //   if (bounds) {
  //     const newBounds = new LatLngBounds(bounds[0] as LatLngTuple, bounds[1] as LatLngTuple);
  //     setShouldUpdateBounds(true);
  //     setUpdatedBounds(newBounds);
  //   }
  // };

  const toggleForm = () => {
    setShowForm(!showForm);
  };

  return (
    <>
      {showForm && (
        <Formik<IDatasetSearchForm>
          innerRef={formikRef}
          enableReinitialize={true}
          initialValues={formData || DatasetSearchFormInitialValues}
          validationSchema={DatasetSearchFormYupSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={handleDatasetRequestCreation}>
          {(formikProps) => (
            <Box py={4} px={3}>
              <Form>
                <DatasetSearchForm
                  hasResults={props.searchResults.length > 0}
                  toggleForm={toggleForm}
                  onAreaUpdate={props.onAreaUpdate}
                  speciesList={[
                    { value: 'M-ALAL', label: 'Moose (M-ALAL)' },
                    { value: 'M-ORAM', label: 'Mountain Goat (M-ORAM)' },
                    { value: 'M-OVDA', label: 'Thinhorn sheep (M-OVDA)' },
                    { value: 'M-OVDA-DA', label: 'Thinhorn sheep (M-OVDA-DA)' },
                    { value: 'M-OVDA-ST', label: 'Thinhorn sheep (M-OVDA-ST)' },
                    { value: 'M-OVCA', label: 'Bighorn sheep (M-OVCA)' },
                    { value: 'M-OVCA-CA', label: 'Bighorn sheep (M-OVCA-CA)' },
                    { value: 'B-SPOW', label: 'Spotted Owl (B-SPOW)' },
                    { value: 'B-SPOW-CA', label: 'Spotted Owl (B-SPOW-CA)' }
                  ]}
                />

                <Box mt={4}>
                  <Button
                    fullWidth={true}
                    onClick={formikProps.submitForm}
                    variant="contained"
                    color="primary"
                    size="large"
                    type="button"
                    data-testid="dataset-find-button"
                    sx={{
                      fontWeight: 700
                    }}>
                    Find Data
                  </Button>
                </Box>
              </Form>
            </Box>
          )}
        </Formik>
      )}

      {!showForm && (
        <SearchResultList
          searchResults={props.searchResults}
          backToSearch={() => toggleForm()}
          onToggleDataVisibility={props.onToggleDataVisibility}
        />
      )}
    </>
  );
};

export default SideSearchBar;
