// middleware/socketDebug.js
// ✅ Optional: Add this middleware to debug socket availability

export const socketDebugMiddleware = (req, res, next) => {
    const isPickupRoute = req.path.includes('/pickups');
    
    if (isPickupRoute) {
      console.log('🔍 Socket Debug for Pickup Route:');
      console.log('   Path:', req.method, req.path);
      console.log('   req.io exists?', typeof req.io !== 'undefined');
      console.log('   req.io.emit exists?', typeof req.io?.emit === 'function');
      console.log('   Connected clients:', req.io?.engine?.clientsCount || 0);
      
      if (!req.io) {
        console.error('🚨 CRITICAL: req.io is undefined in pickup route!');
        console.error('   This means socket middleware did not run before this route');
      }
    }
    
    next();
  };
  
  // ✅ To use this, add it in server.js AFTER the io middleware but BEFORE routes:
  // import { socketDebugMiddleware } from './middleware/socketDebug.js';
  // app.use(socketDebugMiddleware);