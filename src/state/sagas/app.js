import {
  all, call, takeEvery,
} from 'redux-saga/effects';
import { fetchManifests } from './iiif';
import { fetchWindowManifest } from './windows';
import ActionTypes from '../actions/action-types';

/** */
export function* importState(action) {
  yield all([
    ...Object.entries(action.state.windows || {})
      .map(([_, window]) => call(fetchWindowManifest, { window })),
    ...Object.entries(action.state.manifests || {})
      .filter(([_, manifest]) => !manifest.json)
      .map(([_, manifest]) => call(fetchManifests, manifest.id)),
  ]);
}

/** */
export function* fetchCollectionManifests(action) {
  const { collectionPath, manifestId } = action.payload;
  yield call(fetchManifests, manifestId, ...collectionPath);
}

/** */
export default function* appSaga() {
  yield all([
    takeEvery(ActionTypes.IMPORT_MIRADOR_STATE, importState),
    takeEvery(ActionTypes.SHOW_COLLECTION_DIALOG, fetchCollectionManifests),
  ]);
}
