import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import {
  buildStampedHomeEndpoint,
  createEmptyWorkbenchDocument,
  createEmptyWorkbenchDraft,
} from './runtimeSession';
import type {
  Endpoint,
  FeedbackMessage,
  GameWorkspaceState,
  ReferenceTab,
  StampId,
  WorkbenchDispatchIntent,
} from './types';

const cloneEndpoint = (endpoint: Endpoint | null) => (endpoint ? { ...endpoint } : null);
const cloneDraft = (draft: GameWorkspaceState['draft']) => ({ ...draft });
const cloneDocument = (document: GameWorkspaceState['document']) => ({
  ...document,
  originalSource: cloneEndpoint(document.originalSource),
  source: cloneEndpoint(document.source),
  originalDestination: cloneEndpoint(document.originalDestination),
  destination: cloneEndpoint(document.destination),
});
const initialState: GameWorkspaceState = {
  draft: createEmptyWorkbenchDraft(),
  document: createEmptyWorkbenchDocument(),
  suspendedPackets: {},
  feedback: null,
  referenceTab: 'summary',
  referenceOpen: false,
};

const gameWorkspaceSlice = createSlice({
  name: 'gameWorkspace',
  initialState,
  reducers: {
    resetWorkspace(state) {
      state.draft = createEmptyWorkbenchDraft();
      state.document = createEmptyWorkbenchDocument();
      state.suspendedPackets = {};
      state.feedback = null;
      state.referenceTab = 'summary';
      state.referenceOpen = false;
    },
    focusWorkbenchPacket(
      state,
      action: PayloadAction<{
        packetRuntimeId: string | null;
        source: Endpoint | null;
        destination: Endpoint | null;
      }>,
    ) {
      if (state.draft.packetRuntimeId === action.payload.packetRuntimeId) {
        return;
      }

      const suspendedPacket =
        action.payload.packetRuntimeId == null ? null : state.suspendedPackets[action.payload.packetRuntimeId] ?? null;

      if (action.payload.packetRuntimeId && suspendedPacket) {
        state.draft = cloneDraft(suspendedPacket.draft);
        state.document = {
          ...cloneDocument(suspendedPacket.document),
          placement: 'inbox',
        };
        delete state.suspendedPackets[action.payload.packetRuntimeId];
        state.feedback = null;
        return;
      }

      state.draft = createEmptyWorkbenchDraft(action.payload.packetRuntimeId);
      state.document = {
        packetRuntimeId: action.payload.packetRuntimeId,
        placement: action.payload.packetRuntimeId ? 'inbox' : 'idle',
        originalSource: action.payload.source ? { ...action.payload.source } : null,
        source: action.payload.source ? { ...action.payload.source } : null,
        sourceApplied: false,
        originalDestination: action.payload.destination ? { ...action.payload.destination } : null,
        destination: action.payload.destination ? { ...action.payload.destination } : null,
        destinationApplied: false,
      };
      state.feedback = null;
    },
    moveDocumentToWorkbench(state) {
      if (state.document.packetRuntimeId) {
        state.document.placement = 'workbench';
        state.feedback = null;
      }
    },
    returnDocumentToInbox(state) {
      if (state.document.packetRuntimeId) {
        state.document.placement = 'inbox';
      }
    },
    stashWorkbenchPacket(state) {
      const packetRuntimeId = state.document.packetRuntimeId;

      if (!packetRuntimeId) {
        return;
      }

      state.suspendedPackets[packetRuntimeId] = {
        draft: cloneDraft(state.draft),
        document: {
          ...cloneDocument(state.document),
          placement: 'inbox',
        },
      };
      state.draft = createEmptyWorkbenchDraft();
      state.document = createEmptyWorkbenchDocument();
      state.feedback = null;
    },
    dropSuspendedPacket(state, action: PayloadAction<string>) {
      delete state.suspendedPackets[action.payload];
    },
    chooseStamp(state, action: PayloadAction<StampId>) {
      if (state.document.placement !== 'workbench') {
        return;
      }
      state.draft.stampId = action.payload;
      if (state.draft.appliedStampId !== action.payload) {
        state.draft.appliedStampId = null;
        state.document.source = state.document.originalSource ? { ...state.document.originalSource } : null;
        state.document.sourceApplied = false;
      }
      state.feedback = null;
    },
    applyStampSelection(state) {
      if (state.document.placement !== 'workbench') {
        return;
      }
      state.draft.appliedStampId = state.draft.stampId;
      state.document.source = state.draft.stampId
        ? buildStampedHomeEndpoint(state.draft.stampId)
        : state.document.originalSource
          ? { ...state.document.originalSource }
          : null;
      state.document.sourceApplied = state.draft.stampId !== null;
      state.feedback = null;
    },
    clearStampSelection(state) {
      state.draft.stampId = null;
      state.draft.appliedStampId = null;
      state.document.source = state.document.originalSource ? { ...state.document.originalSource } : null;
      state.document.sourceApplied = false;
    },
    chooseRouteTarget(state, action: PayloadAction<string>) {
      state.draft.routeTargetId = action.payload;
      if (state.draft.appliedRouteTargetId !== action.payload) {
        state.draft.appliedRouteTargetId = null;
        if (state.document.placement === 'workbench') {
          state.document.destination = state.document.originalDestination
            ? { ...state.document.originalDestination }
            : null;
          state.document.destinationApplied = false;
        }
      }
      state.feedback = null;
    },
    applyRouteTargetSelection(state, action: PayloadAction<{ routeTargetId: string; destination: Endpoint }>) {
      if (state.document.placement !== 'workbench') {
        return;
      }
      state.draft.appliedRouteTargetId = action.payload.routeTargetId;
      state.document.destination = { ...action.payload.destination };
      state.document.destinationApplied = true;
      state.feedback = null;
    },
    clearRouteTargetSelection(state) {
      state.draft.routeTargetId = null;
      state.draft.appliedRouteTargetId = null;
      state.document.destination = state.document.originalDestination ? { ...state.document.originalDestination } : null;
      state.document.destinationApplied = false;
    },
    chooseTableEntry(state, action: PayloadAction<string>) {
      state.draft.tableEntryId = action.payload;
      if (state.draft.appliedTableEntryId !== action.payload) {
        state.draft.appliedTableEntryId = null;
        if (state.document.placement === 'workbench') {
          state.document.destination = state.document.originalDestination ? { ...state.document.originalDestination } : null;
          state.document.destinationApplied = false;
        }
      }
      state.feedback = null;
    },
    applyTableEntrySelection(state, action: PayloadAction<{ entryId: string; destination: Endpoint }>) {
      if (state.document.placement !== 'workbench') {
        return;
      }
      state.draft.appliedTableEntryId = action.payload.entryId;
      state.document.destination = { ...action.payload.destination };
      state.document.destinationApplied = true;
      state.feedback = null;
    },
    clearTableEntrySelection(state) {
      state.draft.tableEntryId = null;
      state.draft.appliedTableEntryId = null;
      state.document.destination = state.document.originalDestination ? { ...state.document.originalDestination } : null;
      state.document.destinationApplied = false;
    },
    setDispatchIntent(state, action: PayloadAction<WorkbenchDispatchIntent>) {
      if (state.document.placement !== 'workbench') {
        return;
      }
      state.draft.dispatchIntent = action.payload;
      state.feedback = null;
    },
    clearDispatchIntent(state) {
      state.draft.dispatchIntent = null;
    },
    setFeedback(state, action: PayloadAction<FeedbackMessage>) {
      state.feedback = action.payload;
    },
    clearFeedback(state) {
      state.feedback = null;
    },
    setReferenceTab(state, action: PayloadAction<ReferenceTab>) {
      state.referenceTab = action.payload;
    },
    setReferenceOpen(state, action: PayloadAction<boolean>) {
      state.referenceOpen = action.payload;
    },
  },
});

export const gameWorkspaceReducer = gameWorkspaceSlice.reducer;
export const gameWorkspaceActions = gameWorkspaceSlice.actions;
