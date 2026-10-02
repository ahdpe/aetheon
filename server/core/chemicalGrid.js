import { CONFIG } from '../config.js';
import { random } from './random.js';
import { createChemicalGridClass } from '../../public/js/shared/chemicalCore.js';
export const ChemicalGrid = createChemicalGridClass(CONFIG, random);
