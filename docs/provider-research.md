# Provider research — 2026-10-03

Read official documentation before implementation. Access to documentation does not imply an integration or provider partnership.

| Provider | Evidence | Implementation decision |
|---|---|---|
| RunPod | [GraphQL GPU pricing](https://docs.runpod.io/sdks/graphql/manage-pods), [REST create pod](https://docs.runpod.io/api-reference/pods/POST/pods) | Anonymous catalog request verified with HTTP 200. Prices and stock signals normalized; exact location, storage and total node capacity are not guaranteed by this query. REST lifecycle adapter exists but launch is gated. |
| Vast.ai | [Search offers](https://docs.vast.ai/api-reference/search/search-offers), [create instance](https://docs.vast.ai/api-reference/instances/create-instance) | Bearer-authenticated offer search, instance create, inspect and delete. Credentialed end-to-end execution not tested without an account key. |
| Lambda | [Cloud API](https://docs.lambda.ai/api/cloud) | Instance type endpoint yields whole-node cents/hour and regional availability. Discovery adapter implemented. SSH key and machine bootstrap are not implemented. |
| Akash | [Providers API](https://akash.network/docs/api-documentation/rest-api/providers-api/), [leases](https://akash.network/docs/learn/core-concepts/providers-leases/) | Provider records are not equivalent to executable fixed-price offers. Requires Cosmos deployment, bidding, lease/escrow and certificate workflow. Not integrated. |
| Hyperstack | [Flavors](https://docs.hyperstack.cloud/docs/api-reference/list-flavors/), [pricebook](https://docs.hyperstack.cloud/docs/billing/pricebook/) | Account-specific pricing and provisioning environment needed. Not integrated. |
| SaladCloud | [Developer documentation](https://salad.com/developers/) | Organization/project container groups. Not a interchangeable dedicated-node market. Not integrated. |
| io.net | [API getting started](https://docs.io.net/reference/getting-started-with-your-api-1) | Authenticated account and cluster workflow needed. Not integrated. |
| TensorDock | [Documentation](https://docs.tensordock.com) | API access and schema validation remain unverified. Not integrated. |
| Fluidstack | [Official site](https://www.fluidstack.io) | Enterprise agreement and capacity access needed. Not integrated. |
| CoreWeave | [API tokens and kubeconfig](https://docs.coreweave.com/docs/products/cks/auth-access/manage-api-access-tokens) | Tenant-scoped Kubernetes access needed. Not integrated. |
| Golem | [Requestor](https://docs.golem.network/docs/golem/overview/requestor), [payments](https://docs.golem.network/docs/golem/payments) | Yagna runtime and GLM payments are a distinct execution/settlement system. Not integrated. |

RunPod's anonymous read response was tested live; provider responses are not committed as artificial inventory. Public endpoint accessibility may change. Server failures yield error status without substituting synthetic data.

Hardware catalog memory is a reference variant rather than a claim that every card has that configuration. Offer-reported memory takes precedence. H100 NVL and SXM variants, for example, differ. Benchmarks are not invented or converted into guaranteed workloads.
