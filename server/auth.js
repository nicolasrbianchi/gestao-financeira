export const requireAuth=(req,res,next)=> req.session?.authenticated?next():res.status(401).json({ok:false,error:'Não autenticado'});
