#!/usr/bin/env node
// AS-342: extend example-dashboard.json with a dedicated Subscriptions row.
//
// One-shot migration: inserts a new collapsed row of subscription-specific
// panels and moves the existing "Opened Subscriptions" panel out of the
// generic "Request Details" row so subscription health is discoverable in
// one place.

import { readFileSync, writeFileSync } from "node:fs";

const DASH = new URL("../example-dashboard.json", import.meta.url);
const dashboard = JSON.parse(readFileSync(DASH, "utf8"));

const datasource = { type: "prometheus", uid: "${datasource}" };

const baseTimeseries = (id, title, expr, opts = {}) => ({
  datasource,
  description: opts.description ?? "",
  fieldConfig: {
    defaults: {
      color: { mode: "palette-classic" },
      custom: {
        axisCenteredZero: false,
        axisColorMode: "text",
        axisLabel: "",
        axisPlacement: "auto",
        barAlignment: 0,
        drawStyle: "line",
        fillOpacity: opts.fillOpacity ?? 0,
        gradientMode: "none",
        hideFrom: { legend: false, tooltip: false, viz: false },
        insertNulls: false,
        lineInterpolation: "linear",
        lineWidth: 1,
        pointSize: 5,
        scaleDistribution: { type: "linear" },
        showPoints: "auto",
        spanNulls: false,
        stacking: { group: "A", mode: "none" },
        thresholdsStyle: { mode: "off" },
      },
      mappings: [],
      thresholds: {
        mode: "absolute",
        steps: [{ color: "green" }, { color: "red", value: 80 }],
      },
      unit: opts.unit ?? "none",
    },
    overrides: [],
  },
  gridPos: opts.gridPos,
  id,
  options: {
    legend: {
      calcs: [],
      displayMode: "list",
      placement: "bottom",
      showLegend: true,
    },
    tooltip: { hideZeros: false, mode: "single", sort: "none" },
  },
  pluginVersion: "11.5.1",
  targets: (Array.isArray(expr) ? expr : [{ expr, legend: title }]).map(
    (t, i) => ({
      datasource,
      disableTextWrap: false,
      editorMode: "code",
      expr: t.expr,
      fullMetaSearch: false,
      includeNullMetadata: true,
      legendFormat: t.legend ?? title,
      range: true,
      refId: String.fromCharCode(65 + i),
      useBackend: false,
    }),
  ),
  title,
  type: "timeseries",
});

// Pull the existing Opened Subscriptions panel out of Request Details so the
// new row owns it. Leaves the legacy panel id untouched.
const requestDetails = dashboard.panels.find((p) => p.title === "Request Details");
let opened = requestDetails?.panels?.find((p) => p.title === "Opened Subscriptions");
if (opened) {
  requestDetails.panels = requestDetails.panels.filter(
    (p) => p.title !== "Opened Subscriptions",
  );
} else {
  // Fall back to constructing one if it was already removed in a prior run.
  opened = baseTimeseries(33, "Opened Subscriptions", "apollo_router_opened_subscriptions");
}
opened.description =
  "Current number of opened subscriptions (gauge). Source: apollo.router.opened_subscriptions.";
opened.gridPos = { h: 8, w: 12, x: 0, y: 1 };

const subscriptionPanels = [
  opened,
  baseTimeseries(
    1001,
    "Subscriptions Rejected by Reason",
    'sum by(reason) (rate(apollo_router_operations_subscriptions_rejected_total[$__rate_interval]))',
    {
      description:
        "Rate of subscription requests rejected by the Router, broken down by reason (max_opened_subscriptions_limit_reached or subgraph). Source: apollo.router.operations.subscriptions.rejected.",
      unit: "cps",
      gridPos: { h: 8, w: 12, x: 12, y: 1 },
    },
  ),
  baseTimeseries(
    1002,
    "Subscription Events — Skipped",
    "sum(rate(apollo_router_skipped_event_count_total[$__rate_interval]))",
    {
      description:
        "Rate of subscription events that were skipped (e.g. because no subscribers were active). Source: apollo.router.skipped.event.count.",
      unit: "cps",
      gridPos: { h: 8, w: 12, x: 0, y: 9 },
    },
  ),
  baseTimeseries(
    1003,
    "Subscription HTTP Errors by Subgraph",
    'sum by(subgraph_name) (rate(http_client_request_duration_seconds_count{subgraph_name!="", graphql_errors="true", graphql_operation_type="subscription"}[$__rate_interval]))',
    {
      description:
        "GraphQL errors emitted on subscription operations, broken down by subgraph. Requires the subgraph instrument set up in the README (graphql_errors + graphql_operation_type attributes).",
      unit: "cps",
      gridPos: { h: 8, w: 12, x: 12, y: 9 },
    },
  ),
];

const SUBSCRIPTION_ROW_ID = 1000;
const newRow = {
  collapsed: true,
  gridPos: { h: 1, w: 24, x: 0, y: 24 },
  id: SUBSCRIPTION_ROW_ID,
  panels: subscriptionPanels,
  title: "Subscriptions",
  type: "row",
};

// Drop any prior run's row to make the script idempotent.
dashboard.panels = dashboard.panels.filter((p) => p.id !== SUBSCRIPTION_ROW_ID);

// Insert immediately after the Request Details row so the order is:
//   Overview → Request Details → Subscriptions → Coprocessors → …
const insertAt = dashboard.panels.findIndex((p) => p.title === "Request Details") + 1;
dashboard.panels.splice(insertAt, 0, newRow);

writeFileSync(DASH, JSON.stringify(dashboard, null, 2) + "\n");
console.log(
  `Added Subscriptions row (id=${SUBSCRIPTION_ROW_ID}) with ${subscriptionPanels.length} panels.`,
);
