import {
  all, call, put, select, takeEvery,
} from 'redux-saga/effects';
import { v4 as uuid } from 'uuid';
import ActionTypes from '../actions/action-types';
import MiradorManifest from '../../lib/MiradorManifest';
import {
  setContentSearchCurrentAnnotation,
  selectAnnotation,
  setWorkspaceViewportPosition,
  updateWindow,
  setCanvas,
  fetchSearch,
  receiveManifest,
} from '../actions';
import {
  getSearchForWindow, getSearchAnnotationsForCompanionWindow,
  getCanvasGrouping, getWindow, getManifests, getManifestoInstance,
  getCompanionWindowIdsForPosition, getManifestSearchService,
  getCanvasForAnnotation,
  getSelectedContentSearchAnnotationIds,
  getSortedSearchAnnotationsForCompanionWindow,
  getVisibleCanvasIds,
  getWorkspace,
  getElasticLayout,
} from '../selectors';
import { fetchManifest } from './iiif';

/** */
export function* addProvidedManifest(action) {
  const { manifest, window: { id } } = action;
  if (!manifest) return;

  const manifestId = uuid();

  yield put(receiveManifest(manifestId, manifest));
  yield put(updateWindow(id, { manifestId }));
}

/** */
export function* fetchWindowManifest(action) {
  const { manifestId } = action.payload || action.window;
  if (!manifestId) return;

  const manifests = yield select(getManifests);
  if (!manifests[manifestId]) yield call(fetchManifest, { manifestId });

  yield call(setWindowStartingCanvas, action);
  yield call(setWindowDefaultSearchQuery, action);
}

/** @private */
export function* setWindowStartingCanvas(action) {
  const { canvasId, canvasIndex, manifestId } = action.payload || action.window;

  const windowId = action.id || action.window.id;

  if (canvasId) {
    const thunk = yield call(
      setCanvas, windowId, canvasId, null, { preserveViewport: !!action.payload },
    );
    yield put(thunk);
  } else {
    const manifestoInstance = yield select(getManifestoInstance, { manifestId });
    if (manifestoInstance) {
      // set the startCanvas
      const miradorManifest = new MiradorManifest(manifestoInstance);
      const startCanvas = miradorManifest.startCanvas
        || miradorManifest.canvasAt(canvasIndex || 0)
        || miradorManifest.canvasAt(0);
      if (startCanvas) {
        const thunk = yield call(setCanvas, windowId, startCanvas.id);
        yield put(thunk);
      }
    }
  }
}

/** @private */
export function* setWindowDefaultSearchQuery(action) {
  // only for a brand new window
  if (!action.window || !action.window.defaultSearchQuery) return;

  const { id: windowId, defaultSearchQuery } = action.window;
  const searchService = yield select(getManifestSearchService, { windowId });
  const companionWindowIds = yield select(getCompanionWindowIdsForPosition, { position: 'left', windowId });
  const companionWindowId = companionWindowIds[0];

  if (searchService && companionWindowId) {
    const searchId = searchService && `${searchService.id}?q=${defaultSearchQuery}`;
    yield put(fetchSearch(windowId, companionWindowId, searchId, defaultSearchQuery));
  }
}

/** @private */
export function getAnnotationsBySearch(state, { canvasIds, companionWindowIds, windowId }) {
  const annotationBySearch = companionWindowIds.reduce((accumulator, companionWindowId) => {
    const annotations = getSearchAnnotationsForCompanionWindow(state, {
      companionWindowId, windowId,
    });

    const resourceAnnotations = annotations.resources;
    const hitAnnotation = resourceAnnotations.find(r => canvasIds.includes(r.targetId));

    if (hitAnnotation) accumulator[companionWindowId] = [hitAnnotation.id];

    return accumulator;
  }, {});

  return annotationBySearch;
}

/** @private */
export function* setCurrentAnnotationsOnCurrentCanvas({
  annotationId, windowId, visibleCanvases,
}) {
  const searches = yield select(getSearchForWindow, { windowId });
  const companionWindowIds = Object.keys(searches || {});
  if (companionWindowIds.length === 0) return;

  const annotationBySearch = yield select(
    getAnnotationsBySearch, { canvasIds: visibleCanvases, companionWindowIds, windowId },
  );

  yield all(
    Object.keys(annotationBySearch)
      .map(companionWindowId => (
        put(setContentSearchCurrentAnnotation(
          windowId,
          companionWindowId,
          annotationBySearch[companionWindowId],
        )))),
  );

  // if the currently selected annotation isn't on this canvas, do a thing.
  yield put(selectAnnotation(windowId, Object.values(annotationBySearch)[0][0]));
}

/** @private */
export function* panToFocusedWindow({ pan, windowId }) {
  if (!pan) return;
  const elasticLayout = yield select(getElasticLayout);
  const {
    x, y, width, height,
  } = elasticLayout[windowId] || {};

  const {
    viewportPosition: { width: viewWidth, height: viewHeight },
  } = yield select(getWorkspace);

  yield put(setWorkspaceViewportPosition({
    x: (x + width / 2) - viewWidth / 2,
    y: (y + height / 2) - viewHeight / 2,
  }));
}

/** @private */
export function* updateVisibleCanvases({ windowId }) {
  const { canvasId } = yield select(getWindow, { windowId });
  const visibleCanvases = yield select(getCanvasGrouping, { canvasId, windowId });
  yield put(updateWindow(windowId, { visibleCanvases: (visibleCanvases || []).map(c => c.id) }));
}

/** @private */
export function* setCanvasOfFirstSearchResult({ companionWindowId, windowId }) {
  const selectedIds = yield select(getSelectedContentSearchAnnotationIds, {
    companionWindowId, windowId,
  });

  if (selectedIds.length !== 0) return;

  const annotations = yield select(
    getSortedSearchAnnotationsForCompanionWindow, { companionWindowId, windowId },
  );
  if (!annotations || annotations.length === 0) return;

  yield put(selectAnnotation(windowId, annotations[0].id));
}

/** @private */
export function* setCanvasforSelectedAnnotation({ annotationId, windowId }) {
  const canvasIds = yield select(getVisibleCanvasIds, { windowId });
  const canvas = yield select(getCanvasForAnnotation, {
    annotationId, windowId,
  });

  if (!canvas || canvasIds.includes(canvas.id)) return;

  const thunk = yield call(setCanvas, windowId, canvas.id);
  yield put(thunk);
}

/** */
export default function* windowsSaga() {
  yield all([
    takeEvery(ActionTypes.ADD_WINDOW, addProvidedManifest),
    takeEvery(ActionTypes.ADD_WINDOW, fetchWindowManifest),
    takeEvery(ActionTypes.UPDATE_WINDOW, fetchWindowManifest),
    takeEvery(ActionTypes.SET_CANVAS, setCurrentAnnotationsOnCurrentCanvas),
    takeEvery(ActionTypes.SET_WINDOW_VIEW_TYPE, updateVisibleCanvases),
    takeEvery(ActionTypes.RECEIVE_SEARCH, setCanvasOfFirstSearchResult),
    takeEvery(ActionTypes.SELECT_ANNOTATION, setCanvasforSelectedAnnotation),
    takeEvery(ActionTypes.FOCUS_WINDOW, panToFocusedWindow),
  ]);
}
