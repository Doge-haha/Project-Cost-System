rootProject.name = "saas-pricing-platform"

include(":apps:backend")
include(":apps:worker")
include(":apps:mcp-gateway")

project(":apps:backend").projectDir = file("apps/backend")
project(":apps:worker").projectDir = file("apps/worker")
project(":apps:mcp-gateway").projectDir = file("apps/mcp-gateway")

