import React, { useState, useEffect, useReducer } from 'react';

import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import AddIcon from '@material-ui/icons/Add';

import {
  SideBySideViewer,
  PictureInPictureViewer,
  getChannelStats
} from '../../src';
import sources from './source-info';
import {
  createLoader,
  channelsReducer,
  useWindowSize,
  buildDefaultSelection
} from './utils';

import ChannelController from './components/ChannelController';
import Menu from './components/Menu';
import MenuToggle from './components/MenuToggle';
import ColormapSelect from './components/ColormapSelect';
import SourceSelect from './components/SourceSelect';

import {
  MAX_CHANNELS,
  DEFAULT_VIEW_STATE,
  DEFAULT_OVERVIEW,
  FILL_PIXEL_VALUE,
  COLOR_PALLETE
} from './constants';

const initialChannels = {
  sliders: [],
  colors: [],
  selections: [],
  ids: [],
  isOn: []
};

function App() {
  const [channels, dispatch] = useReducer(channelsReducer, initialChannels);
  const viewSize = useWindowSize();
  const [loader, setLoader] = useState({});
  const [sourceName, setSourceName] = useState('tiff');
  const [colormap, setColormap] = useState('');
  const [dimensions, setDimensions] = useState({});

  const [useLinkedView, toggleLinkedView] = useReducer(v => !v, false);
  const [overviewOn, setOverviewOn] = useReducer(v => !v, false);
  const [controllerOn, toggleController] = useReducer(v => !v, true);
  const [zoomLock, toggleZoomLock] = useReducer(v => !v, true);
  const [panLock, togglePanLock] = useReducer(v => !v, true);

  const [isLoading, setIsLoading] = useState(true);
  const [pixelValues, setPixelValues] = useState([]);
  useEffect(() => {
    async function changeLoader() {
      setIsLoading(true);
      const sourceInfo = sources[sourceName];
      const nextLoader = await createLoader(sourceInfo.url);
      const { dimensions: newDimensions, isRgb } = nextLoader;
      const selections = buildDefaultSelection(newDimensions);
      let sliders = [
        [0, 255],
        [0, 255],
        [0, 255]
      ];
      let domains = [
        [0, 255],
        [0, 255],
        [0, 255]
      ];
      let colors = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255]
      ];
      if (!isRgb) {
        const stats = await getChannelStats({
          loader: nextLoader,
          loaderSelection: selections
        });
        domains = stats.map(stat => stat.domain);
        sliders = stats.map(stat => stat.autoSliders);
        colors = stats.map((_, i) => COLOR_PALLETE[i]);
      }
      setDimensions(newDimensions);
      dispatch({
        type: 'RESET_CHANNELS',
        value: { selections, domains, sliders, colors }
      });
      setLoader(nextLoader);
      setIsLoading(false);
      setPixelValues(new Array(selections.length).fill(FILL_PIXEL_VALUE));
    }
    changeLoader();
  }, [sourceName]);

  /*
   * Handles updating state for each channel controller.
   * Is is too heavy weight to store each channel as an object in state,
   * so we store the individual viv props (colorValues, sliderValues, etc)
   * in separate arrays. We use the ordering of the channels in the menu to make
   * update state very responsive (but dispatching the index of the channel)
   */
  const handleControllerChange = (index, type, value) => {
    if (type === 'CHANGE_CHANNEL') {
      const [channelDim] = dimensions;
      const { field, values } = channelDim;
      const dimIndex = values.indexOf(value);
      const selection = { [field]: value };
      dispatch({
        type,
        index,
        value: { selection }
      });
    } else {
      dispatch({ type, index, value });
    }
  };

  const handleChannelAdd = () => {
    const selection = {};

    dimensions.forEach(dimension => {
      // Set new image to default selection for non-global selections (0)
      // and use current global selection otherwise.
      selection[dimension.field] = GLOBAL_SLIDER_DIMENSION_FIELDS.includes(
        dimension.field
      )
        ? Object.values(channels)[0].selection[dimension.field]
        : 0;
    });
    dispatch({
      type: 'ADD_CHANNEL',
      value: {
        selection
      }
    });
  };
  const { isPyramid, numLevels, isRgb } = loader;
  const initialViewState = {
    target: [loader.height / 2, loader.width / 2, 0],
    zoom: numLevels > 0 ? -(numLevels - 2) : -2
  };
  const { colors, sliders, isOn, ids, selections, domains } = channels;
  const channelControllers = ids.map((id, i) => {
    const name = dimensions.filter(i => i.field === 'channel')[0].values[
      selections[i].channel
    ];
    return (
      <Grid
        key={`channel-controller-${name}-${id}`}
        style={{ width: '100%' }}
        item
      >
        <ChannelController
          name={name}
          channelOptions={dimensions[0].values}
          isOn={isOn[i]}
          sliderValue={sliders[i]}
          colorValue={colors[i]}
          domain={domains[i]}
          handleChange={(type, value) => handleControllerChange(i, type, value)}
          colormapOn={colormap.length > 0}
          pixelValue={pixelValues[i]}
          shouldShowPixelValue={!useLinkedView}
        />
      </Grid>
    );
  });
  return (
    <>
      {!isLoading &&
        (useLinkedView && isPyramid ? (
          <SideBySideViewer
            loader={loader}
            sliderValues={sliders}
            colorValues={colors}
            channelIsOn={isOn}
            loaderSelection={selections}
            initialViewState={{
              ...(initialViewState || DEFAULT_VIEW_STATE),
              height: viewSize.height,
              width: viewSize.width * 0.5
            }}
            colormap={colormap.length > 0 && colormap}
            zoomLock={zoomLock}
            panLock={panLock}
            hoverHooks={{ handleValue: setPixelValues }}
          />
        ) : (
          <PictureInPictureViewer
            loader={loader}
            sliderValues={sliders}
            colorValues={colors}
            channelIsOn={isOn}
            loaderSelection={selections}
            initialViewState={{
              ...(initialViewState || DEFAULT_VIEW_STATE),
              height: viewSize.height,
              width: viewSize.width
            }}
            colormap={colormap.length > 0 && colormap}
            overview={DEFAULT_OVERVIEW}
            overviewOn={overviewOn && isPyramid}
            hoverHooks={{ handleValue: setPixelValues }}
          />
        ))}
      {controllerOn && (
        <Menu maxHeight={viewSize.height}>
          <Grid container justify="space-between">
            <Grid item xs={6}>
              <SourceSelect
                value={sourceName}
                handleChange={setSourceName}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={5}>
              <ColormapSelect
                value={colormap}
                handleChange={setColormap}
                disabled={isLoading}
              />
            </Grid>
          </Grid>
          {!isLoading && !isRgb ? (
            <Grid container>{channelControllers}</Grid>
          ) : (
            <Grid container justify="center">
              {!isRgb && <CircularProgress />}
            </Grid>
          )}
          {!isRgb && (
            <Button
              disabled={ids.length === MAX_CHANNELS || isLoading}
              onClick={handleChannelAdd}
              fullWidth
              variant="outlined"
              style={{ borderStyle: 'dashed' }}
              startIcon={<AddIcon />}
              size="small"
            >
              Add Channel
            </Button>
          )}
          <Button
            disabled={!isPyramid || isLoading || useLinkedView}
            onClick={() => setOverviewOn(prev => !prev)}
            variant="outlined"
            size="small"
            fullWidth
          >
            {overviewOn ? 'Hide' : 'Show'} Picture-In-Picture
          </Button>
          <Button
            disabled={!isPyramid || isLoading || overviewOn}
            onClick={toggleLinkedView}
            variant="outlined"
            size="small"
            fullWidth
          >
            {useLinkedView ? 'Hide' : 'Show'} Side-by-Side
          </Button>
          {useLinkedView && (
            <>
              <Button
                disabled={!isPyramid || isLoading}
                onClick={toggleZoomLock}
                variant="outlined"
                size="small"
                fullWidth
              >
                {zoomLock ? 'Unlock' : 'Lock'} Zoom
              </Button>
              <Button
                disabled={!isPyramid || isLoading}
                onClick={togglePanLock}
                variant="outlined"
                size="small"
                fullWidth
              >
                {panLock ? 'Unlock' : 'Lock'} Pan
              </Button>
            </>
          )}
        </Menu>
      )}
      <Box position="absolute" right={0} top={0} m={2}>
        <MenuToggle on={controllerOn} toggle={toggleController} />
      </Box>
    </>
  );
}
export default App;
