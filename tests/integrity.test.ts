import { describe, expect, it } from 'vitest';

import { validateProgressState } from '../src/features/game/progressIntegrity';
import { scenarioDayMap } from '../src/features/game/scenarios';
import { validateTrafficState } from '../src/features/game/sessionIntegrity';
import { startCampaign } from '../src/features/game/gameSlice';
import { createTestStore } from './helpers/createTestStore';

describe('integrity validators', () => {
  it('accepts a freshly started campaign state as valid', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());

    const state = store.getState().game;
    const trafficIssues = validateTrafficState(
      state.traffic,
      scenarioDayMap[state.progress.currentDayId!],
      state.table.ids.map((id) => state.table.entities[id]!).filter(Boolean),
    );
    const progressIssues = validateProgressState(state.progress);

    expect(trafficIssues).toEqual([]);
    expect(progressIssues).toEqual([]);
  });

  it('detects broken traffic run links and duplicate command consumption', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());

    const state = store.getState().game;
    const packetRuntimeId = state.traffic.pendingPacketIds[0]!;
    const brokenTraffic = {
      ...state.traffic,
      runId: null,
      commandHistory: [
        {
          id: 'command-1',
          sequence: 1,
          kind: 'submitVerdict' as const,
          dayId: state.traffic.dayId,
          runId: 'other-run',
          packetRuntimeId,
          payload: { verdict: 'ACCEPT' },
        },
      ],
      actionResults: [
        {
          id: 'action-1',
          sequence: 1,
          action: 'ACCEPT' as const,
          sourceId: packetRuntimeId,
          subjectLabel: 'subject',
          runId: 'other-run',
          packetRuntimeId,
          rngSeedBefore: 1,
          rngSeedAfter: 2,
          outcomeCode: 'registeredMapping' as const,
          incidentKind: null,
          causedIncident: false,
          auditMessage: 'ok',
          feedbackMessage: 'ok',
          feedbackTone: 'success' as const,
          context: {
            workbenchPacketRuntimeId: packetRuntimeId,
            draftStampId: null,
            draftRouteTargetId: null,
            draftTableEntryId: null,
            appliedStampId: null,
            appliedRouteTargetId: null,
            appliedTableEntryId: null,
            draftDispatchIntent: null,
            documentSource: null,
            documentDestination: null,
            matchingEntryIds: [],
            conflictingEntryId: null,
            createdTableEntryId: null,
            activatedEntryId: null,
            autoAssignedStampId: null,
            deliveredTarget: null,
            expectedTarget: null,
            expiredEntryIds: [],
            preservedEntryIds: [],
          },
        },
      ],
      currentTurn: {
        packetRuntimeId,
        commandIds: ['command-1'],
      },
      resolvedTurns: [
        {
          id: 'turn-1',
          sequence: 1,
          dayId: state.traffic.dayId,
          runId: 'other-run',
          packetRuntimeId,
          commandIds: ['command-1'],
          actionResultId: 'action-1',
          checkpointId: null,
          causedIncident: false,
          outcomeCode: 'registeredMapping' as const,
        },
        {
          id: 'turn-2',
          sequence: 2,
          dayId: state.traffic.dayId,
          runId: 'other-run',
          packetRuntimeId,
          commandIds: ['command-1'],
          actionResultId: 'action-1',
          checkpointId: null,
          causedIncident: false,
          outcomeCode: 'registeredMapping' as const,
        },
      ],
    };

    const issues = validateTrafficState(
      brokenTraffic,
      scenarioDayMap[state.progress.currentDayId!],
      [],
    );
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain('missingRunId');
    expect(codes).toContain('recordRunMismatch');
    expect(codes).toContain('duplicateCommandConsumption');
  });

  it('detects broken progress links for active, inspected, and archived runs', () => {
    const store = createTestStore();

    store.dispatch(startCampaign());

    const brokenProgress = {
      ...store.getState().game.progress,
      activeRunId: 'missing-run',
      inspectedRunId: 'missing-archive-run',
      dayHistory: [
        {
          runId: 'missing-run',
          dayId: 'day-1',
          dayNumber: 1,
          title: 'DAY 1',
          kind: 'clear' as const,
          actionCount: 1,
          incidentCount: 0,
          daySeed: 1,
          outcomeBreakdown: [],
          incidentBreakdown: [],
        },
      ],
      runArchives: [
        {
          id: 'archive-1',
          sequence: 1,
          runId: 'ghost-run',
          dayId: 'day-1',
          dayNumber: 1,
          title: 'DAY 1',
          resolutionKind: null,
          archiveReason: 'abandoned' as const,
          actionCount: 0,
          incidentCount: 0,
          exportSnapshot: {
            dayId: 'day-1',
            runId: 'ghost-run',
            dayNumber: 1,
            sessionStatus: 'active' as const,
            route: {
              firstDayId: 'day-1',
              currentDayId: 'day-1',
              nextDayId: null,
              inspectedRunId: null,
              unlockedDayIds: ['day-1'],
              clearedDayIds: [],
              failedDayIds: [],
            },
            activeRunId: null,
            runHistory: [],
            transitions: [],
            trafficSnapshot: {
              dayId: 'day-1',
              runId: 'ghost-run',
              sessionStatus: 'active' as const,
              packets: [],
              packetOrder: [],
              activePacketId: null,
              upcomingPacketIds: [],
              pendingPacketIds: [],
              resolvedPacketIds: [],
              actionClock: 0,
              commandHistory: [],
              actionResults: [],
              currentTurn: { packetRuntimeId: null, commandIds: [] },
              resolvedTurns: [],
              sessionEvents: [],
              checkpoints: [],
              objectives: [],
              nextCommandSequence: 1,
              nextActionSequence: 1,
              nextTurnSequence: 1,
              nextEventSequence: 1,
              nextCheckpointSequence: 1,
              nextRuntimeOrdinal: 0,
              daySeed: 1,
              rngSeed: 1,
            },
            tableSnapshot: {
              entries: [],
              nextSequence: 1,
            },
            auditSnapshot: {
              logs: [],
              nextSequence: 1,
            },
            packetLedgers: [],
            commands: [],
            turns: [],
            actions: [],
            events: [],
            checkpoints: [],
            objectives: [],
            tableEntries: [],
          },
        },
      ],
    };

    const codes = validateProgressState(brokenProgress).map((issue) => issue.code);

    expect(codes).toContain('activeRunMissing');
    expect(codes).toContain('inspectedRunMissing');
    expect(codes).toContain('historyRunMissing');
    expect(codes).toContain('archiveRunMissing');
  });
});
