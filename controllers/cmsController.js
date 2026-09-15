import { LandingPageContentModel } from '../models/LandingPageContent.js';

export const cmsController = {
  // GET /api/cms/landing-page
  async getLandingPageContent(req, res) {
    try {
      const mode = req.query.mode;
      const isAdmin = Boolean(
        req.headers.authorization ||
        req.headers['x-admin-key'] ||
        req.headers['x-admin-role'] ||
        process.env.NODE_ENV === 'development'
      );

      if (mode === 'draft' && isAdmin) {
        const draft = await LandingPageContentModel.getDraft();
        return res.json({ success: true, data: draft, mode: 'draft' });
      }

      const published = await LandingPageContentModel.getPublished();
      return res.json({ success: true, data: published, mode: 'published' });
    } catch (err) {
      console.error('Error in getLandingPageContent:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve landing page content',
        error: err.message,
      });
    }
  },

  // PUT /api/cms/landing-page
  async updateLandingPageContent(req, res) {
    try {
      const content = req.body;
      if (!content || typeof content !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Invalid payload: content body must be a JSON object',
        });
      }

      const updated = await LandingPageContentModel.saveDraft(content);
      return res.json({
        success: true,
        message: 'Draft changes saved successfully',
        data: updated,
      });
    } catch (err) {
      console.error('Error in updateLandingPageContent:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to save landing page draft',
        error: err.message,
      });
    }
  },

  // POST /api/cms/landing-page/publish
  async publishLandingPageContent(req, res) {
    try {
      const published = await LandingPageContentModel.publish();
      return res.json({
        success: true,
        message: 'Landing page changes published live successfully!',
        data: published,
      });
    } catch (err) {
      console.error('Error in publishLandingPageContent:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to publish landing page content',
        error: err.message,
      });
    }
  },

  // POST /api/cms/upload
  uploadMedia(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }
      const host = req.get('host');
      const protocol = req.protocol;
      const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

      return res.json({
        success: true,
        message: 'File uploaded successfully',
        url: fileUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } catch (err) {
      console.error('Error in uploadMedia:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload media file',
        error: err.message,
      });
    }
  },

  // POST /api/cms/reset
  async resetLandingPageContent(req, res) {
    try {
      const resetData = await LandingPageContentModel.resetToDefaults();
      return res.json({
        success: true,
        message: 'Landing page content reset to defaults',
        data: resetData,
      });
    } catch (err) {
      console.error('Error in resetLandingPageContent:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset landing page content',
        error: err.message,
      });
    }
  },
};
