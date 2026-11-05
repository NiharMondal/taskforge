const nodeExternals = require("webpack-node-externals");

module.exports = (options) => ({
  ...options,
  // Nest leaves every package in node_modules to Node at runtime. Workspace
  // packages (`@taskforge/shared`) ship TypeScript source, so bundle them;
  // their own dependencies (e.g. fractional-indexing) are bundled with them.
  externals: [nodeExternals({ allowlist: [/^@taskforge\//] })],
  resolve: {
    ...options.resolve,
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
