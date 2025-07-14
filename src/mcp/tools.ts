export const MCP_TOOLS = [
  {
    name: "search_ico_registrations",
    description: "Search ICO registrations by various criteria",
    inputSchema: {
      type: "object",
      properties: {
        organisationName: {
          type: "string",
          description: "Organisation name to search for (partial match)"
        },
        registrationNumber: {
          type: "string",
          description: "Exact registration number"
        },
        postcode: {
          type: "string",
          description: "Postcode to search for (partial match)"
        },
        publicAuthority: {
          type: "string",
          description: "Whether it's a public authority (Y/N)"
        },
        paymentTier: {
          type: "string",
          description: "Payment tier (e.g., 'Tier 1', 'Tier 2')"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        },
        offset: {
          type: "number",
          description: "Number of results to skip",
          default: 0
        }
      }
    }
  },
  {
    name: "get_ico_registration",
    description: "Get a specific ICO registration by registration number",
    inputSchema: {
      type: "object",
      properties: {
        registrationNumber: {
          type: "string",
          description: "The registration number to look up"
        }
      },
      required: ["registrationNumber"]
    }
  },
  {
    name: "get_registrations_by_organisation",
    description: "Get ICO registrations for a specific organisation",
    inputSchema: {
      type: "object",
      properties: {
        organisationName: {
          type: "string",
          description: "Name of the organisation"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        }
      },
      required: ["organisationName"]
    }
  },
  {
    name: "get_registrations_by_postcode",
    description: "Get ICO registrations for a specific postcode area",
    inputSchema: {
      type: "object",
      properties: {
        postcode: {
          type: "string",
          description: "Postcode to search for"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        }
      },
      required: ["postcode"]
    }
  },
  {
    name: "get_data_version",
    description: "Get current data version and statistics",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_all_data_versions",
    description: "Get all data version history",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];