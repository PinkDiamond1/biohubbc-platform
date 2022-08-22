import { LayersControl, TileLayer } from 'react-leaflet';

const BaseLayerControls: React.FC<React.PropsWithChildren> = () => {
  return (
    <>
      <LayersControl.BaseLayer checked name="BC Government">
        <TileLayer url="https://maps.gov.bc.ca/arcgis/rest/services/province/roads_wm/MapServer/tile/{z}/{y}/{x}" />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Esri Imagery">
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/en-us/arcgis/products/location-services/services/basemaps">ESRI Basemap</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      </LayersControl.BaseLayer>
    </>
  );
};

export default BaseLayerControls;
