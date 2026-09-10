import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getPyqRegistrySnapshot,
  loadDedicatedCsatDataset,
  loadTaggedMainsDatasets,
} from "../brain/pyqLinkEngine.js";
import { buildPyqCorpusInventory, getWorkspacePyqMetrics } from "../brain/pyqCorpusInventory.js";
import { loadCSATData } from "../data/loaders/csatLoader.js";
import { physicalQuestionIdentity } from "../scripts/buildPyqMasterIndex.js";

const diskMaster = JSON.parse(fs.readFileSync(new URL("../data/pyq_index/pyq_master_index.json", import.meta.url), "utf8"));
const diskByNode = JSON.parse(fs.readFileSync(new URL("../data/pyq_index/pyq_by_node.json", import.meta.url), "utf8"));
const sourceQuestions = Object.values(loadCSATData()).flat();
const sourceIds = new Set(sourceQuestions.map(q => q.id));
const formerlyDropped = sourceQuestions.filter(q => !diskMaster[q.id]);

test("all 47 formerly dropped CSAT IDs survive as independent physical questions", () => {
  const registry = getPyqRegistrySnapshot();
  const inventory = buildPyqCorpusInventory(registry);
  assert.equal(sourceIds.size, 1200);
  assert.equal(formerlyDropped.length, 47);
  assert.equal(inventory.physical.CSAT.size, 1200);
  assert.equal(new Set(sourceQuestions.map(q => physicalQuestionIdentity(q))).size, 1200);
  assert.deepEqual([...sourceIds].filter(id => !inventory.physical.CSAT.has(id)), []);
  assert(formerlyDropped.every(q => registry.master[q.id]?.id === q.id));
});

test("known 180-character collisions retain distinct canonical identities", () => {
  const pairs = [
    ["csat_lr_2019_80", "csat_lr_2019_79"],
    ["csat_rc_2015_41", "csat_rc_2015_25"],
    ["PRE_CSAT_2025_059", "PRE_CSAT_2025_055"],
  ];
  const registry = getPyqRegistrySnapshot();
  for (const [left, right] of pairs) {
    assert(registry.master[left], left);
    assert(registry.master[right], right);
    assert.notEqual(physicalQuestionIdentity(registry.master[left]), physicalQuestionIdentity(registry.master[right]));
  }
});

test("runtime master and every node stage bucket contain unique canonical IDs", () => {
  const registry = getPyqRegistrySnapshot();
  assert.equal(new Set(Object.keys(registry.master)).size, Object.keys(registry.master).length);
  for (const [id, q] of Object.entries(registry.master)) assert.equal(q.id, id);
  for (const [nodeId, bucket] of Object.entries(registry.byNode)) {
    for (const stage of ["prelims", "mains", "csat", "essay", "ethics", "optional"]) {
      const ids = bucket[stage] || [];
      assert.equal(new Set(ids).size, ids.length, `${nodeId}:${stage}`);
    }
  }
});

test("tagged and dedicated loaders are completely idempotent", () => {
  const master = structuredClone(diskMaster);
  const byNode = structuredClone(diskByNode);
  loadTaggedMainsDatasets(byNode, master);
  loadDedicatedCsatDataset(byNode, master);
  const first = structuredClone({ master, byNode });
  loadTaggedMainsDatasets(byNode, master);
  loadDedicatedCsatDataset(byNode, master);
  assert.deepEqual({ master, byNode }, first);
});

test("208 source conflicts remain unresolved and 28 invalid nodes stay outside coverage", () => {
  const registry = getPyqRegistrySnapshot();
  const inventory = buildPyqCorpusInventory(registry);
  assert.equal(registry.sourceDiagnostics.contentConflictIds.length, 208);
  assert(registry.sourceDiagnostics.contentConflictIds.every(id => registry.master[id].sourceCertification?.status === "unresolved-content-conflict"));
  assert.equal(inventory.invalid.nodeIds.length, 28);
  const invalidIds = new Set(inventory.invalid.nodeIds.map(row => row.id));
  assert([...invalidIds].every(id => !inventory.workspaces.CSAT.mappedAnyIds.has(id)));
});

test("all eight workspace corpus equations hold", () => {
  const inventory = buildPyqCorpusInventory();
  for (const key of ["GS1", "GS2", "GS3", "GS4", "ESSAY", "CSAT", "OPTIONAL_P1", "OPTIONAL_P2"]) {
    const metrics = getWorkspacePyqMetrics(key, null, inventory);
    assert(metrics.mappedInCorpusUnique <= metrics.physicalCorpusTotal, key);
    assert.equal(metrics.mappedInCorpusUnique + metrics.unmappedInCorpus, metrics.physicalCorpusTotal, key);
  }
});
