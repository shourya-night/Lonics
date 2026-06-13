import { supabase } from '../supabase.js';

// In-memory cache to track loaded cargo classes per container window ID (to match Supabase schema limits)
export const windowCargoClassesCache = new Map(); // window_id -> Set of cargo classes

// Hazardous Material Cross-Exclusion Matrix
const EXCLUSION_MATRIX = {
  'explosive': ['explosive', 'flammable', 'toxic', 'corrosive', 'chemical', 'foodstuff'],
  'flammable': ['explosive', 'flammable', 'toxic', 'corrosive', 'foodstuff'],
  'toxic': ['explosive', 'flammable', 'toxic', 'foodstuff'],
  'corrosive': ['explosive', 'flammable', 'corrosive', 'foodstuff'],
  'chemical': ['explosive', 'foodstuff'],
  'foodstuff': ['explosive', 'flammable', 'toxic', 'corrosive', 'chemical'],
  'general': [],
  'carton': [],
  'pallet': [],
  'drum': [],
  'bale': []
};

function areIncompatible(classA, classB) {
  const a = classA.toLowerCase().trim();
  const b = classB.toLowerCase().trim();
  
  if (EXCLUSION_MATRIX[a] && EXCLUSION_MATRIX[a].includes(b)) {
    return true;
  }
  if (EXCLUSION_MATRIX[b] && EXCLUSION_MATRIX[b].includes(a)) {
    return true;
  }
  return false;
}

export async function compatibilityGuard(req, res, next) {
  try {
    const payload = req.body;
    let items = [];
    
    if (Array.isArray(payload)) {
      items = payload;
    } else if (payload && Array.isArray(payload.cargo_items)) {
      items = payload.cargo_items;
    } else {
      return res.status(400).json({ error: 'Invalid payload: cargo items array is required.' });
    }

    if (items.length === 0) {
      return next();
    }

    const newClasses = items.map(item => item.cargo_class || item.package_type || 'General');

    // 1. Check internal compatibility of the incoming items array
    for (let i = 0; i < newClasses.length; i++) {
      for (let j = i + 1; j < newClasses.length; j++) {
        if (areIncompatible(newClasses[i], newClasses[j])) {
          return res.status(400).json({
            error: 'COMPATIBILITY_BREACH',
            message: `Internal Cargo Conflict: Item ${i+1} (${newClasses[i]}) is incompatible with Item ${j+1} (${newClasses[j]}) in the same request.`
          });
        }
      }
    }

    // 2. Check compatibility against already loaded cargo in the active container
    const shipperId = payload.shipper_id || 'SHIP-DFC-001';
    
    // Find latest active container window from shipments for this shipper
    const { data: latestShipment, error: findError } = await supabase
      .from('shipments')
      .select('assigned_window_id')
      .eq('shipper_id', shipperId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let activeWindowId = latestShipment?.assigned_window_id || `WIN-${shipperId}-PRIMARY`;

    const existingClasses = windowCargoClassesCache.get(activeWindowId) || new Set();

    // Match each new class against existing classes in the container queue cache
    for (const newClass of newClasses) {
      for (const existingClass of existingClasses) {
        if (areIncompatible(newClass, existingClass)) {
          return res.status(400).json({
            error: 'COMPATIBILITY_BREACH',
            message: `Co-loading safety violation: Incoming cargo class '${newClass}' cannot be co-loaded with existing cargo class '${existingClass}' already in active container '${activeWindowId}'.`
          });
        }
      }
    }

    // Attach verified new classes to the request so we can save them in cache on successful booking commit
    req.newCargoClasses = newClasses;
    req.assignedWindowId = activeWindowId;

    next();
  } catch (error) {
    console.error('[Compatibility Guard] Exception:', error);
    return res.status(500).json({ error: 'Internal validation error during compatibility check.' });
  }
}
