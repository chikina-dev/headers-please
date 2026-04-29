import { AnimatePresence, motion } from 'motion/react'

import { InspectionScreen } from './InspectionScreen'
import { ResolutionScreen } from './ResolutionScreen'
import { TitleScreen } from './TitleScreen'
import { useGameViewModel } from './useGameViewModel'

export function GameRoot() {
  const viewModel = useGameViewModel()

  const renderScene = () => {
  if (viewModel.screen === 'title') {
    return (
      <TitleScreen
        totalUnits={viewModel.catalogSummary.totalUnits}
        totalDays={viewModel.catalogSummary.totalDays}
        runSummary={viewModel.runHistorySummary}
        archiveSummary={viewModel.runArchiveSummary}
        latestArchive={viewModel.archiveList[0] ?? null}
        onStart={viewModel.actions.startCampaign}
        onInspectLatestArchive={viewModel.actions.inspectRunArchive}
      />
    )
  }

  if (!viewModel.day) {
    return null
  }

  if (viewModel.screen === 'dayClear') {
    return (
      <ResolutionScreen
        toneLabel="Result"
        title={viewModel.resolution?.title ?? viewModel.day.title}
        message={viewModel.resolution?.message}
        daySummary={viewModel.dayRuntimeSummary}
        summary={viewModel.campaignSummary}
        unlockSummary={viewModel.resolutionUnlockSummary}
        replayLabel="同じ Day を再試行"
        buttonLabel="次の Day へ"
        onReplay={viewModel.actions.replayCurrentDay}
        onNext={viewModel.actions.advanceToNextDay}
      />
    )
  }

  if (viewModel.screen === 'dayFailure') {
    return (
      <ResolutionScreen
        toneLabel="Failure"
        title={viewModel.resolution?.title ?? viewModel.day.title}
        message={viewModel.resolution?.message}
        daySummary={viewModel.dayRuntimeSummary}
        summary={viewModel.campaignSummary}
        unlockSummary={viewModel.resolutionUnlockSummary}
        replayLabel="同じ Day を再試行"
        buttonLabel="次の Day へ"
        onReplay={viewModel.actions.replayCurrentDay}
        onNext={viewModel.actions.advanceToNextDay}
      />
    )
  }

  if (viewModel.screen === 'campaignComplete') {
    return (
      <ResolutionScreen
        toneLabel="Result"
        title={viewModel.resolution?.title ?? 'GLORY TO NAPT'}
        message={viewModel.resolution?.message}
        summary={viewModel.campaignSummary}
      />
    )
  }

  return (
    <InspectionScreen
      title={viewModel.day.title}
      dayUnit={viewModel.day.unit}
      dayNumber={viewModel.day.dayNumber}
      dayPhaseId={viewModel.day.phaseId}
      learningGoal={viewModel.day.learningGoal}
      progress={viewModel.progress}
      isArchiveInspection={viewModel.isArchiveInspection}
      inspectedRunArchive={viewModel.inspectedRunArchive}
      packet={viewModel.packet}
      availableVerdicts={viewModel.availableVerdicts}
      incomingPacket={viewModel.incomingPacket}
      incomingPackets={viewModel.incomingPackets}
      upcomingPacketCount={viewModel.upcomingPacketCount}
      workbenchPlacement={viewModel.workbenchPlacement}
      packetRewritePreview={viewModel.packetRewritePreview}
      workbenchStatus={viewModel.workbenchStatus}
      workbenchDispatchIntent={viewModel.workbenchDispatchIntent}
      trafficBoard={viewModel.trafficBoard}
      latestActionResult={viewModel.latestActionResult}
      recentActionSlips={viewModel.recentActionSlips}
      dayRuntimeSummary={viewModel.dayRuntimeSummary}
      shiftGoalSummary={viewModel.shiftGoalSummary}
      stampOptions={viewModel.stampOptions}
      routeSlipTargets={viewModel.routeSlipTargets}
      draftRouteTargetSummary={viewModel.draftRouteTargetSummary}
      appliedRouteTargetSummary={viewModel.appliedRouteTargetSummary}
      draftStampSummary={viewModel.draftStampSummary}
      appliedStampSummary={viewModel.appliedStampSummary}
      feedback={viewModel.feedback}
      columns={viewModel.columns}
      tableFeatureFlags={viewModel.tableFeatureFlags}
      rows={viewModel.rows}
      tableUsageSummary={viewModel.tableUsageSummary}
      matchingEntryIds={viewModel.matchingEntryIds}
      selectedEntryId={viewModel.selectedEntryId}
      appliedEntryId={viewModel.appliedEntryId}
      draftEntrySummary={viewModel.draftEntrySummary}
      selectedEntrySummary={viewModel.selectedEntrySummary}
      tableView={viewModel.tableView}
      tableFilterOptions={viewModel.tableFilterOptions}
      unitReference={viewModel.unitReference}
      referenceOpen={viewModel.referenceOpen}
      referenceSummary={viewModel.referenceSummary}
      actionChecklist={viewModel.actionChecklist}
      glossaryEntries={viewModel.glossaryEntries}
      referenceTab={viewModel.referenceTab}
      auditLog={viewModel.auditLog}
      archiveSummary={viewModel.runArchiveSummary}
      archiveList={viewModel.archiveList}
      runHistorySummary={viewModel.runHistorySummary}
      sessionIntegrity={viewModel.sessionIntegrity}
      progressIntegrity={viewModel.progressIntegrity}
      onChooseStamp={viewModel.actions.chooseStamp}
      onChooseRouteTarget={viewModel.actions.chooseRouteTarget}
      onChooseTableEntry={viewModel.actions.chooseTableEntry}
      onPullPacketToWorkbench={viewModel.actions.pullPacketToWorkbench}
      onShelveWorkbenchPacket={viewModel.actions.shelveWorkbenchPacket}
      onWaitOneTurn={viewModel.actions.waitOneTurn}
      onApplyRouteTargetSelection={viewModel.actions.applyRouteTargetSelection}
      onApplyStampSelection={viewModel.actions.applyStampSelection}
      onSetDispatchIntent={viewModel.actions.setDispatchIntent}
      onCommitWorkbenchDispatch={viewModel.actions.commitWorkbenchDispatch}
      onDropStampSelection={viewModel.actions.dropStampSelection}
      onReplayCurrentDay={viewModel.actions.replayCurrentDay}
      onInspectRunArchive={viewModel.actions.inspectRunArchive}
      onSetSortMode={viewModel.actions.setSortMode}
      onSetExternalPortFilter={viewModel.actions.setExternalPortFilter}
      onSetDestinationHostFilter={viewModel.actions.setDestinationHostFilter}
      onChooseRow={viewModel.actions.chooseTableEntry}
      onApplyTableEntrySelection={viewModel.actions.applyTableEntrySelection}
      onSetReferenceTab={viewModel.actions.setReferenceTab}
      onSetReferenceOpen={viewModel.actions.setReferenceOpen}
      onCloseSelectedRow={viewModel.actions.closeSelectedTableEntry}
    />
  )
  }

  const sceneKey =
    viewModel.screen === 'title'
      ? 'title'
      : viewModel.screen === 'campaignComplete'
        ? 'campaign-complete'
        : viewModel.day
          ? `${viewModel.screen}:${viewModel.day.id}`
          : viewModel.screen

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={sceneKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="h-full"
      >
        {renderScene()}
      </motion.div>
    </AnimatePresence>
  )
}
