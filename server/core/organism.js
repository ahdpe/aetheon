import { CONFIG } from '../config.js';
import { random } from './random.js';
import { createOrganismClass } from '../../public/js/shared/organismCore.js';
export const Organism = createOrganismClass(CONFIG, random);
