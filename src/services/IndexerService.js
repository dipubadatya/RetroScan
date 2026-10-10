import { RomIndexer } from './indexer';

const indexerInstance = new RomIndexer();

export const scanAndIndexDirectory = (rootPath, onProgress) =>
  indexerInstance.scanAndIndexDirectory(rootPath, onProgress);

export const cancelScan = () => indexerInstance.cancel();

export { RomIndexer, RomIndexer as default };
