import {
  all, call, takeEvery,
} from 'redux-saga/effects';
import { fetchManifest } from './iiif';
import { fetchWindowManifest } from './windows';
import ActionTypes from '../actions/action-types';

/** */
export function* importState(action) {
  yield all([
    ...Object.entries(action.state.windows || {})
      .map(([_, window]) => call(fetchWindowManifest, { id: window.id, payload: window })),
    ...Object.entries(action.state.manifests || {})
      .filter(([_, manifest]) => !manifest.json)
      .map(([_, manifest]) => call(fetchManifest, { manifestId: manifest.id })),
  ]);
}

/** */
export default function* appSaga() {
  yield all([
    takeEvery(ActionTypes.IMPORT_MIRADOR_STATE, importState),
  ]);
}
