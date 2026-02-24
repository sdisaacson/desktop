# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_22￼
Filters and Topics
AI Mode
All
Short videos
Videos
News
Forums
Images
More
Tools
Search Results
AI Overview
AI Overview
To upgrade ESLint, you need to update the package in your project and potentially migrate your configuration file to the new flat config format if you are upgrading to a major version like v9 or v10, which introduced significant breaking changes. ￼
￼
ESLint
 +1
Step 1: Update the ESLint package
First, update the ESLint package in your project's devDependencies by running one of the following commands in your terminal: ￼
￼
GitHub
npm:
bash￼
npm i eslint@latest -D
Yarn:
bash￼
yarn add eslint@latest -D
pnpm:
bash￼
pnpm add eslint@latest -D
 ￼
After running the command, delete your lock file (package-lock.json, yarn.lock, etc.) and node_modules directory, then reinstall packages using npm install (or your package manager's equivalent command) to ensure all dependencies are updated correctly. ￼
￼
Vue School
Step 2: Migrate your configuration (if needed) ￼
If you are upgrading to a major version (like from v8 to v9 or v9 to v10), the configuration system has changed to the new "flat config" format (eslint.config.js or eslint.config.mjs). The old .eslintrc.* files are deprecated. ￼
￼
ESLint
 +1
ESLint provides a migration tool to help you convert your existing configuration: ￼
bash￼
npx @eslint/migrate-config .eslintrc.json
(Replace .eslintrc.json with your existing config file name if it's different, e.g., .eslintrc.js or .eslintrc.yml). ￼
￼
ESLint
 +4
This tool will generate a new eslint.config.js file (or .mjs file) with your existing rules and settings in the new format. ￼
￼
ESLint
 +1
Step 3: Update plugins and dependencies
You will also need to update any related plugins and parsers (e.g., @typescript-eslint/eslint-plugin, @typescript-eslint/parser, eslint-plugin-react-hooks) to versions compatible with the new ESLint version. ￼
￼
Medium
 +2
Update TypeScript ESLint:
bash￼
npm install @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest -D
 ￼
Refer to the specific ESLint Migration Guide for the version you are upgrading to for detailed instructions on breaking changes and plugin compatibility. ￼
￼
ESLint
 +3
Step 4: Run ESLint
Once updated and configured, run ESLint to test the new setup: ￼
￼
GitHub
bash￼
npx eslint . --fix
This will run ESLint with the new configuration and attempt to fix any autofixable problems. ￼
￼
Vue School
 +3
Migrate to v9.x - ESLint - Pluggable JavaScript Linter
As announced in our blog post, in ESLint v9. 0.0, eslint. config. js is the new default configuration format. The previous format,
￼
ESLint
￼
The Great ESLint 9.0 Migration Adventure: A Developer’s Survival ...
Mar 18, 2025 — The Migration Checklist ✅ Before diving into the migration process, here's a clear roadmap to guide you: * Update ESLint to v9: Up...
￼
Medium
Upgrading Eslint from v8 to v9 in Vue.js - Vue School Articles
Dec 8, 2024 — js project. * Step 1: Install npm-check-updates (NCU) To avoid dependency conflicts, start by using npm-check-updates (NCU). NCU s...
￼
Vue School
￼
Show all
    pkgs.yarn
    # pkgs.go
    # pkgs.python311
    # pkgs.python311Packages.pip
    # pkgs.nodePackages.nodemon
  ];

  # Sets environment variables in the workspace
  env = {};
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];

    # Enable previews
    previews = {
      enable = true;
      previews = {
        # web = {
        #   # Example: run "npm run dev" with PORT set to IDX's defined port for previews,
        #   # and show it in IDX's web preview panel
        #   command = ["npm" "run" "dev"];
        #   manager = "web";
        #   env = {
        #     # Environment variables to set for your server
        #     PORT = "$PORT";
        #   };
        # };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        # Example: install JS dependencies from NPM
        npm-install = "npm install";
      };
      # Runs when the workspace is (re)started
      onStart = {
        # Example: start a background task to watch and re-build backend code
        # watch-backend = "npm run watch-backend";
      };
    };
  };
}
