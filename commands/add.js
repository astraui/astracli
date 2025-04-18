import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to your UI components source - relative to this file
const COMPONENTS_PATH = join(__dirname, '../components/ui');

// Map of component dependencies
const COMPONENT_DEPENDENCIES = {
  'Accordion': ['Collapsible'],
};

// Modern separator for visual breaks
const separator = () => console.log(chalk.dim('─'.repeat(60)));

function getCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-based, so add 1
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


/**
 * Detect which package manager is being used in the project
 * @returns {string} The package manager command (pnpm, yarn, npm)
 */
function detectPackageManager() {
  try {
    // Check for lockfiles to determine the package manager
    if (fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'))) {
      return 'pnpm';
    } else if (fs.existsSync(path.join(process.cwd(), 'yarn.lock'))) {
      return 'yarn';
    } else if (fs.existsSync(path.join(process.cwd(), 'package-lock.json'))) {
      return 'npm';
    } else {
      return 'pnpm'; // Default to pnpm as requested
    }
  } catch (error) {
    return 'pnpm'; // Fallback to pnpm
  }
}

/**
 * Install required dependencies using the appropriate package manager
 * @param {string[]} dependencies - List of dependencies to install
 * @returns {Promise<boolean>} Whether installation was successful
 */
async function installDependencies(dependencies) {
  if (!dependencies.length) return true;

  const packageManager = detectPackageManager();
  const installCmd = packageManager === 'yarn' ? 'add' : 'install';

  const spinner = ora({
    text: `Installing dependencies using ${packageManager}...`,
    color: 'cyan'
  }).start();

  try {
    // Create the command based on the package manager
    const command = `${packageManager} ${installCmd} ${dependencies.join(' ')}`;

    // Execute the installation command
    execSync(command, { stdio: 'pipe' });

    spinner.succeed(`Installed dependencies: ${chalk.bold(dependencies.join(', '))}`);
    return true;
  } catch (error) {
    spinner.fail(`Failed to install dependencies`);
    console.error(chalk.red(`  └─ Installation error. Please install manually.`));
    console.log(chalk.dim(`  └─ Run: ${chalk.cyan(`pnpm install ${dependencies.join(' ')}`)}`));
    return false;
  }
}

/**
 * Ensures the lib/utils.ts file exists with the cn utility function and class-variance-authority
 * @param {boolean} useTypeScript - Whether to create a TypeScript or JavaScript file
 * @returns {Promise<void>}
 */
async function ensureUtilsFileExists(useTypeScript = true) {
  const utilsFileName = useTypeScript ? 'utils.ts' : 'utils.js';
  const utilsFilePath = path.join(process.cwd(), 'lib', utilsFileName);
  const libDirPath = path.join(process.cwd(), 'lib');

  // Create the lib directory if it doesn't exist
  const dirSpinner = ora({
    text: 'Creating lib directory',
    color: 'cyan'
  }).start();

  try {
    await fs.ensureDir(libDirPath);
    dirSpinner.succeed(`Created lib directory at ${chalk.dim('./lib')}`);
  } catch (error) {
    dirSpinner.info(`Lib directory already exists at ${chalk.dim('./lib')}`);
  }

  let existingContent = '';
  let hasCvaImport = false;

  // Check if the file already exists and read its content
  if (fs.existsSync(utilsFilePath)) {
    existingContent = await fs.readFile(utilsFilePath, 'utf8');
    hasCvaImport = existingContent.includes('from "class-variance-authority"');

    if (hasCvaImport) {
      const infoSpinner = ora({
        text: 'Checking for class-variance-authority',
        color: 'cyan'
      }).start();
      infoSpinner.succeed(`class-variance-authority import already exists in ${chalk.dim(`./lib/${utilsFileName}`)}`);
    }
  }

  // Create or update the file if needed
  if (!existingContent || !hasCvaImport) {
    const fileSpinner = ora({
      text: existingContent ? `Updating ${utilsFileName} file` : `Creating ${utilsFileName} file`,
      color: 'cyan'
    }).start();

    try {
      let utilsContent;

      if (!existingContent) {
        // Create a new file with both utilities
        utilsContent = `import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva, type VariantProps } from "class-variance-authority";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`;
      } else {
        // Add the cva import to the existing content
        utilsContent = `import { cva, type VariantProps } from "class-variance-authority";
${existingContent}`;
      }

      await fs.writeFile(utilsFilePath, utilsContent);
      fileSpinner.succeed(`${existingContent ? 'Updated' : 'Created'} ${chalk.dim(`./lib/${utilsFileName}`)} with ${existingContent ? 'class-variance-authority import' : 'cn utility function and class-variance-authority import'}`);
    } catch (error) {
      fileSpinner.fail(`Could not ${existingContent ? 'update' : 'create'} ${chalk.dim(`./lib/${utilsFileName}`)}`);
      console.error(chalk.red(error.message));
    }
  }

  // Always check for required dependencies regardless of file update
  const depsSpinner = ora({
    text: 'Checking required dependencies',
    color: 'cyan'
  }).start();

  // Added motion and lucide-react to the required dependencies
  const requiredDeps = ['clsx', 'tailwind-merge', 'class-variance-authority', 'motion', 'lucide-react'];
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = await fs.readJSON(packageJsonPath);

      // Check for both motion and framer-motion since motion is the new name for framer-motion
      const missingDeps = requiredDeps.filter(dep => {
        if (dep === 'motion') {
          // Check if either motion or framer-motion is installed
          const hasMotion = packageJson.dependencies?.['motion'] || packageJson.devDependencies?.['motion'];
          const hasFramerMotion = packageJson.dependencies?.['framer-motion'] || packageJson.devDependencies?.['framer-motion'];
          return !hasMotion && !hasFramerMotion;
        }
        return !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep];
      });

      // Replace 'motion' with 'framer-motion' in the dependencies list as that's the actual package name
      const installDeps = missingDeps.map(dep => dep === 'motion' ? 'framer-motion' : dep);

      if (installDeps.length > 0) {
        depsSpinner.succeed('Dependencies check completed');

        // Install missing dependencies automatically
        console.log(chalk.dim(`Installing required dependencies: ${chalk.white(installDeps.join(', '))}`));
        await installDependencies(installDeps);
      } else {
        depsSpinner.succeed('All required dependencies are installed');
      }
    } catch (error) {
      depsSpinner.fail(`Failed to check dependencies: ${error.message}`);
    }
  } else {
    depsSpinner.warn('Could not check dependencies (package.json not found)');
  }
}

/**
 * Ensures that motion (formerly framer-motion) is installed 
 * @returns {Promise<void>}
 */
async function ensureMotionIsInstalled() {
  const spinner = ora({
    text: 'Checking for motion/framer-motion',
    color: 'cyan'
  }).start();

  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = await fs.readJSON(packageJsonPath);

      // Check if either motion or framer-motion is installed
      const hasMotion = packageJson.dependencies?.['motion'] || packageJson.devDependencies?.['motion'];
      const hasFramerMotion = packageJson.dependencies?.['framer-motion'] || packageJson.devDependencies?.['framer-motion'];

      if (!hasMotion && !hasFramerMotion) {
        spinner.info('Motion/framer-motion not found. Installing framer-motion...');

        // Install framer-motion
        await installDependencies(['framer-motion']);
      } else {
        spinner.succeed(`Motion${hasFramerMotion ? ' (as framer-motion)' : ''} is already installed`);
      }
    } catch (error) {
      spinner.fail(`Failed to check for motion/framer-motion: ${error.message}`);
    }
  } else {
    spinner.warn('Could not check for motion/framer-motion (package.json not found)');
  }
}

/**
 * Ensures that lucide-react is installed
 * @returns {Promise<void>}
 */
async function ensureLucideReactIsInstalled() {
  const spinner = ora({
    text: 'Checking for lucide-react',
    color: 'cyan'
  }).start();

  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = await fs.readJSON(packageJsonPath);

      // Check if lucide-react is installed
      const hasLucideReact = packageJson.dependencies?.['lucide-react'] || packageJson.devDependencies?.['lucide-react'];

      if (!hasLucideReact) {
        spinner.info('lucide-react not found. Installing...');

        // Install lucide-react
        await installDependencies(['lucide-react']);
      } else {
        spinner.succeed('lucide-react is already installed');
      }
    } catch (error) {
      spinner.fail(`Failed to check for lucide-react: ${error.message}`);
    }
  } else {
    spinner.warn('Could not check for lucide-react (package.json not found)');
  }
}

/**
 * Automatically initializes the project with default configuration
 * @param {Object} options - Configuration options
 * @returns {Object} The created configuration
 */
async function autoInitialize(options) {
  const spinner = ora({
    text: 'Automatically initializing Astra...',
    color: 'cyan'
  }).start();

  try {
    // Create a default configuration
    const defaultConfig = {
      ui: {
        components: {
          path: options.path || './components/ui',
          typescript: true
        }
      }
    };

    // Write the configuration file
    await fs.writeJSON('astra.config.json', defaultConfig, { spaces: 2 });

    // Ensure the components directory exists
    await fs.ensureDir(defaultConfig.ui.components.path);

    spinner.succeed(chalk.bold('Astra has been automatically initialized'));
    return defaultConfig;
  } catch (error) {
    spinner.fail(chalk.bold.red('Failed to initialize Astra'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Add components to the project
 * @param {string[]} components - List of components to add
 * @param {Object} options - Configuration options
 */
export async function add(components, options) {
  separator();
  console.log(chalk.bold.cyan(`Astra Installation`));
  console.log(chalk.dim(getCurrentDateTime()));
  separator();

  let config;

  // Check if project is initialized with Astra
  if (!fs.existsSync('astra.config.json')) {
    console.log(chalk.yellow(chalk.bold('Astra is not initialized.') + ' Initializing automatically...'));
    config = await autoInitialize(options);
  } else {
    // Load existing configuration
    config = await fs.readJSON('astra.config.json');
  }

  const componentsPath = options.path || config.ui.components.path;
  const useTypeScript = config.ui.components.typescript !== false; // Default to TypeScript if not specified

  console.log(chalk.dim(`Target directory: ${chalk.white(componentsPath)}`));
  console.log(chalk.dim(`TypeScript: ${useTypeScript ? chalk.white('enabled') : chalk.white('disabled')}`));
  separator();

  // Ensure the lib/utils file exists with class-variance-authority
  await ensureUtilsFileExists(useTypeScript);

  // Ensure motion/framer-motion is installed
  await ensureMotionIsInstalled();

  // Ensure lucide-react is installed
  await ensureLucideReactIsInstalled();

  // Ensure the components directory exists
  await fs.ensureDir(componentsPath);

  // Track dependencies to be installed
  const installQueue = [...components];
  const installedComponents = new Set();
  const failedComponents = new Set();

  // Process all components including dependencies
  while (installQueue.length > 0) {
    const component = installQueue.shift();

    // Skip if already processed
    if (installedComponents.has(component) || failedComponents.has(component)) {
      continue;
    }

    const spinner = ora({
      text: `Adding ${chalk.bold(component)} component`,
      color: 'cyan'
    }).start();

    try {
      // Check if component exists in the repository
      const componentSourceDir = path.join(COMPONENTS_PATH, component);
      if (!fs.existsSync(componentSourceDir)) {
        spinner.fail(`Component ${chalk.bold(component)} not found`);
        failedComponents.add(component);
        continue;
      }

      // Create component directory in target project
      const componentDestDir = path.join(process.cwd(), componentsPath, component);

      // Check if component already exists
      if (fs.existsSync(componentDestDir) && !options.force) {
        spinner.warn(`Component ${chalk.bold(component)} already exists. Use ${chalk.cyan('--force')} to overwrite`);
        installedComponents.add(component); // Consider it installed to avoid dependency warnings
        continue;
      }

      // Copy component files
      await fs.copy(componentSourceDir, componentDestDir, { overwrite: options.force });

      // Process TypeScript files to update imports
      const files = await fs.readdir(componentDestDir);
      for (const file of files) {
        if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const filePath = path.join(componentDestDir, file);
          let content = await fs.readFile(filePath, 'utf8');

          // Update import paths
          content = content.replace(
            /from ['"]@\/lib\/utils['"]/g,
            `from '@/lib/utils'`
          );

          // Update component imports
          content = content.replace(
            /from ['"]@\/components\/ui\/([^'"]+)['"]/g,
            `from '@/components/ui/$1'`
          );

          await fs.writeFile(filePath, content);
        }
      }

      spinner.succeed(`Added ${chalk.bold(component)} component to ${chalk.dim(componentDestDir)}`);
      installedComponents.add(component);

      // Add dependencies to the installation queue
      const dependencies = COMPONENT_DEPENDENCIES[component] || [];
      for (const dep of dependencies) {
        if (!installedComponents.has(dep) && !installQueue.includes(dep)) {
          console.log(chalk.dim(`  └─ Dependency required: ${chalk.italic(dep)}`));
          installQueue.push(dep);
        }
      }

    } catch (error) {
      spinner.fail(`Failed to add ${chalk.bold(component)} component`);
      console.error(chalk.red('  └─ ' + error.message));
      failedComponents.add(component);
    }
  }

  separator();

  // Installation summary
  if (installedComponents.size > 0) {
    console.log(chalk.green.bold(`Installation Summary`));
    console.log(chalk.green(`Successfully added ${chalk.bold(installedComponents.size)} component(s):`));
    console.log(chalk.green(`  ${Array.from(installedComponents).join(', ')}`));
  }

  if (failedComponents.size > 0) {
    console.log(chalk.red.bold(`\nFailures`));
    console.log(chalk.red(`Failed to add ${chalk.bold(failedComponents.size)} component(s):`));
    console.log(chalk.red(`  ${Array.from(failedComponents).join(', ')}`));
    console.log(chalk.yellow(`\nRun ${chalk.bold('astui list')} to verify available components.`));
  }

  separator();
}
