import React from 'react';
import { shallow } from 'enzyme';
import OpenSeadragon from 'openseadragon';
import { Utils } from 'manifesto.js/dist-esmodule/Utils';
import { OpenSeadragonViewer } from '../../../src/components/OpenSeadragonViewer';
import CanvasWorld from '../../../src/lib/CanvasWorld';
import fixture from '../../fixtures/version-2/019.json';

const canvases = Utils.parseManifest(fixture).getSequences()[0].getCanvases();

jest.mock('openseadragon');


describe('OpenSeadragonViewer', () => {
  let wrapper;
  let updateViewport;
  beforeEach(() => {
    OpenSeadragon.mockClear();

    updateViewport = jest.fn();

    wrapper = shallow(
      <OpenSeadragonViewer
        classes={{}}
        infoResponses={[{
          id: 'a',
          json: {
            '@id': 'http://foo',
            height: 200,
            width: 100,
          },
        }, {
          id: 'b',
          json: {
            '@id': 'http://bar',
            height: 201,
            width: 150,
          },
        }]}
        nonTiledImages={[{
          id: 'http://foo',
        }]}
        windowId="base"
        config={{}}
        updateViewport={updateViewport}
        t={k => k}
        canvasWorld={new CanvasWorld(canvases)}
      >
        <div className="foo" />
        <div className="bar" />
      </OpenSeadragonViewer>,
    );
  });
  it('renders the component', () => {
    expect(wrapper.find('.mirador-osd-container').length).toBe(1);
  });
  it('renders child components enhanced with additional props', () => {
    expect(wrapper.find('.foo').length).toBe(1);
    expect(wrapper.find('.foo').props()).toEqual(expect.objectContaining({
      zoomToWorld: wrapper.instance().zoomToWorld,
    }));
    expect(wrapper.find('.bar').length).toBe(1);
    expect(wrapper.find('.bar').props()).toEqual(expect.objectContaining({
      zoomToWorld: wrapper.instance().zoomToWorld,
    }));
  });

  describe('infoResponsesMatch', () => {
    it('when they do not match', () => {
      expect(wrapper.instance().infoResponsesMatch([])).toBe(false);
    });
    it('with an empty array', () => {
      wrapper.instance().viewer = {
        close: () => {},
      };
      wrapper.setProps({ infoResponses: [] });
      expect(wrapper.instance().infoResponsesMatch([])).toBe(true);
    });
    it('when the @ids do match', () => {
      const newInfos = [
        { id: 'a', json: { '@id': 'http://foo' } },
        { id: 'b', json: { '@id': 'http://bar' } },
      ];
      expect(wrapper.instance().infoResponsesMatch(newInfos)).toBe(true);
    });
    it('when the @ids do not match', () => {
      expect(wrapper.instance().infoResponsesMatch([{ id: 'a', json: { '@id': 'http://foo-degraded' } }])).toBe(false);
    });
  });

  describe('nonTiledImagedMatch', () => {
    it('when they do not match', () => {
      expect(wrapper.instance().nonTiledImagedMatch([])).toBe(false);
    });
    it('with an empty array', () => {
      wrapper.instance().viewer = {
        close: () => {},
      };
      wrapper.setProps({ nonTiledImages: [] });
      expect(wrapper.instance().nonTiledImagedMatch([])).toBe(true);
    });
    it('when the ids do match', () => {
      expect(wrapper.instance().nonTiledImagedMatch([{ id: 'http://foo' }])).toBe(true);
    });
  });

  describe('addAllImageSources', () => {
    it('calls addTileSource for every tileSources and then zoomsToWorld', () => {
      wrapper.instance().viewer = {
        close: () => {},
      };
      wrapper.setProps({ infoResponses: [1, 2, 3, 4] });
      const mockAddTileSource = jest.fn();
      wrapper.instance().addTileSource = mockAddTileSource;
      wrapper.instance().addAllImageSources();
      expect(mockAddTileSource).toHaveBeenCalledTimes(4);
    });
    it('calls addNonTileSource for every nonTiledImage and then zoomsToWorld', () => {
      wrapper.instance().viewer = {
        close: () => {},
      };
      wrapper.setProps({ nonTiledImages: [1, 2, 3, 4] });
      const mockAddNonTiledImage = jest.fn();
      wrapper.instance().addNonTiledImage = mockAddNonTiledImage;
      wrapper.instance().addAllImageSources();
      expect(mockAddNonTiledImage).toHaveBeenCalledTimes(4);
    });
  });

  describe('addTileSource', () => {
    it('calls addTiledImage asynchronously on the OSD viewer', async () => {
      wrapper.instance().addTileSource({}).then((event) => {
        expect(event).toBe('event');
      });
    });
    it('when a viewer is not available, returns an unresolved Promise', () => {
      expect(wrapper.instance().addTileSource({})).toEqual(expect.any(Promise));
    });
  });

  describe('refreshTileProperties', () => {
    it('updates the index and opacity of the OSD tiles from the canvas world', () => {
      const setOpacity = jest.fn();
      const setItemIndex = jest.fn();
      const canvasWorld = {
        contentResource: i => i,
        layerIndexOfImageResource: i => 1 - i,
        layerOpacityOfImageResource: i => 0.5,
      };
      wrapper.setProps({ canvasWorld });
      wrapper.instance().loaded = true;
      wrapper.setState({
        viewer: {
          world: {
            getItemAt: i => ({ setOpacity, source: { id: i } }),
            getItemCount: () => 2,
            setItemIndex,
          },
        },
      });

      wrapper.instance().refreshTileProperties();

      expect(setOpacity).toHaveBeenCalledTimes(1);
      expect(setOpacity.mock.calls[0]).toEqual([0.5]);

      expect(setItemIndex).toHaveBeenCalledTimes(1);
      expect(setItemIndex.mock.calls[0][0].source.id).toEqual(1);
      expect(setItemIndex.mock.calls[0][1]).toEqual(0);
    });
  });

  describe('fitBounds', () => {
    it('calls OSD viewport.fitBounds with provided x, y, w, h', () => {
      const fitBounds = jest.fn();

      wrapper.setState({
        viewer: {
          viewport: {
            fitBounds,
          },
        },
      });

      wrapper.instance().fitBounds(1, 2, 3, 4);
      expect(
        fitBounds,
      ).toHaveBeenCalledWith(expect.any(OpenSeadragon.Rect), true);
    });
  });

  describe('zoomToWorld', () => {
    it('uses fitBounds with the existing CanvasWorld', () => {
      const fitBounds = jest.fn();
      wrapper.instance().fitBounds = fitBounds;
      wrapper.instance().zoomToWorld();
      expect(fitBounds).toHaveBeenCalledWith(0, 0, 5041, 1800, true);
    });
  });

  describe('componentDidMount', () => {
    let panTo;
    let zoomTo;
    let addHandler;
    beforeEach(() => {
      panTo = jest.fn();
      zoomTo = jest.fn();
      addHandler = jest.fn();

      wrapper = shallow(
        <OpenSeadragonViewer
          classes={{}}
          tileSources={[{ '@id': 'http://foo' }]}
          windowId="base"
          viewerConfig={{ x: 1, y: 0, zoom: 0.5 }}
          config={{}}
          updateViewport={updateViewport}
          canvasWorld={new CanvasWorld([])}
          t={k => k}
        >
          <div className="foo" />
        </OpenSeadragonViewer>,
      );

      wrapper.instance().ref = { current: true };

      OpenSeadragon.mockImplementation(() => ({
        addHandler,
        addTiledImage: jest.fn().mockResolvedValue('event'),
        viewport: { panTo, zoomTo },
      }));
    });

    it('calls the OSD viewport panTo and zoomTo with the component state', () => {
      wrapper.instance().componentDidMount();

      expect(panTo).toHaveBeenCalledWith(
        { x: 1, y: 0, zoom: 0.5 }, true,
      );
      expect(zoomTo).toHaveBeenCalledWith(
        0.5, { x: 1, y: 0, zoom: 0.5 }, true,
      );
    });

    it('adds animation-start/finish flag for rerendering performance', () => {
      wrapper.instance().componentDidMount();

      expect(addHandler).toHaveBeenCalledWith('animation-start', expect.anything());
      expect(addHandler).toHaveBeenCalledWith('animation-finish', expect.anything());
      expect(addHandler).toHaveBeenCalledWith('animation-finish', wrapper.instance().onViewportChange);
    });
  });

  describe('componentDidUpdate', () => {
    it('calls the OSD viewport panTo and zoomTo with the component state and forces a redraw', () => {
      const panTo = jest.fn();
      const zoomTo = jest.fn();
      const forceRedraw = jest.fn();

      wrapper.setState({
        viewer: {
          forceRedraw,
          viewport: {
            centerSpringX: { target: { value: 10 } },
            centerSpringY: { target: { value: 10 } },
            panTo,
            zoomSpring: { target: { value: 1 } },
            zoomTo,
          },
        },
      });

      wrapper.setProps({ viewerConfig: { x: 0.5, y: 0.5, zoom: 0.1 } });
      wrapper.setProps({ viewerConfig: { x: 1, y: 0, zoom: 0.5 } });

      expect(panTo).toHaveBeenCalledWith(
        { x: 1, y: 0, zoom: 0.5 }, false,
      );
      expect(zoomTo).toHaveBeenCalledWith(
        0.5, { x: 1, y: 0, zoom: 0.5 }, false,
      );
      expect(forceRedraw).not.toHaveBeenCalled();
    });
  });

  describe('onViewportChange', () => {
    it('translates the OSD viewport data into an update to the component state', () => {
      wrapper.instance().onViewportChange({
        eventSource: {
          viewport: {
            centerSpringX: { target: { value: 1 } },
            centerSpringY: { target: { value: 0 } },
            zoomSpring: { target: { value: 0.5 } },
          },
        },
      });

      expect(updateViewport).toHaveBeenCalledWith(
        'base',
        { x: 1, y: 0, zoom: 0.5 },
      );
    });
  });
});
