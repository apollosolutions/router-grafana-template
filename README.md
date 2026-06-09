# Apollo Router Grafana Dashboard Example

NOTE: Please use the new [APM Template Repository](https://github.com/apollographql/apm-templates/tree/main/grafana)

![example dashboard preview](./imgs/dashboard-preview.png)

This repository contains a [JSON file](./example-dashboard.json) containing an example [Grafana](https://grafana.com/oss/grafana/) dashboard for reference or use with the Apollo Router.

**The code in this repository is experimental and has been provided for reference purposes only. Community feedback is welcome but this project may not be supported in the same way that repositories in the official [Apollo GraphQL GitHub organization](https://github.com/apollographql) are. If you need help you can file an issue on this repository, [contact Apollo](https://www.apollographql.com/contact-sales) to talk to an expert, or create a ticket directly in Apollo Studio.**

## Installation

This repository contains the JSON needed to [import as a new dashboard](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/import-dashboards/) in your Grafana instance. 

This dashboard requires: 
- Grafana
- A Prometheus datasource
- Prometheus gathering metrics from the Apollo Router running v2.0 or higher

This dashboard also leverages the following telemetry configuration for the router:

```yaml
telemetry:
  instrumentation:
    instruments:
      router:
        http.server.request.duration:
          attributes:
            http.response.status_code: true
            graphql.errors:
              on_graphql_error: true
      subgraph:
        http.client.request.duration:
          attributes:
            subgraph.name: true
            http.response.status_code:
              subgraph_response_status: code
            graphql.errors:
              subgraph_on_graphql_error: true
            # Needed by the Subscriptions row to filter subgraph errors to subscription
            # operations only. Without this attribute the "Subscription HTTP Errors by
            # Subgraph" panel returns no series.
            graphql.operation.type:
              graphql_operation_type: true
        http.client.request.body.size:
          attributes:
            subgraph.name: true
      connector:
        http.client.request.body.size: true
        http.client.request.duration: true
        http.client.response.body.size: true
```

## Subscriptions

A dedicated **Subscriptions** row exposes the subscription-specific metrics
Apollo Router emits out of the box. Tracks [AS-342] and
[TSH-20886](https://apollographql.atlassian.net/browse/TSH-20886) (Coinbase request).

| Panel | Source metric | Notes |
| --- | --- | --- |
| Opened Subscriptions | `apollo_router_opened_subscriptions` | Current count of open subscription sessions (gauge). |
| Subscriptions Rejected by Reason | `apollo_router_operations_subscriptions_rejected_total` (label: `reason`) | Rate of subscription requests the Router rejected, broken down by `reason` (`max_opened_subscriptions_limit_reached` or `subgraph`). |
| Subscription Events — Skipped | `apollo_router_skipped_event_count_total` | Rate of events the Router dropped (e.g. no live subscribers). |
| Subscription HTTP Errors by Subgraph | `http_client_request_duration_seconds_count` filtered by `graphql_operation_type="subscription"` and `graphql_errors="true"` | Requires the `graphql.operation.type` instrument attribute shown above. |

`apollo_router_opened_subscriptions`, `apollo_router_skipped_event_count_total`,
and `apollo_router_operations_subscriptions_rejected_total` are emitted by
Router 2.x without any additional configuration as long as your Prometheus
scrape is wired up to the Router OTel/Prometheus endpoint.

To rebuild the dashboard JSON from the migration script (idempotent):

```bash
node scripts/add-subscriptions-row.mjs
```

[AS-342]: https://apollographql.atlassian.net/browse/AS-342

## Usage

Once imported, select your datasource in the top variable section and the dashboard should populate so long as you use the standard metric values. 

## Known Limitations

The template does not include any panels for resource views; this data is often bespoke to the environments in which the router is run, therefore it is easier to add your own panels from the correct datasources. 

There are sections for resources, however, to be able to input the necessary panels. 
