export default {fetch(){return Response.json({configured:false,imageConfigured:!!process.env.OPENAI_IMAGE_API_KEY},{headers:{'Cache-Control':'no-store'}});}};
