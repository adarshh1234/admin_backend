import mongoose from 'mongoose';
import { defaultLandingPageContent } from '../data/defaultLandingPageContent.js';

const LandingPageContentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'main_cms_content',
    },
    live: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...defaultLandingPageContent, status: 'published' }),
    },
    draft: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...defaultLandingPageContent, status: 'draft' }),
    },
    history: [
      {
        publishedAt: { type: String },
        summary: { type: String },
      },
    ],
  },
  {
    timestamps: true,
    minimize: false, // Ensure empty objects/structures are preserved
  }
);

export const LandingPageContent = mongoose.model('LandingPageContent', LandingPageContentSchema);

export const LandingPageContentModel = {
  async getPublished() {
    let doc = await LandingPageContent.findOne({ key: 'main_cms_content' });
    if (!doc) {
      doc = await LandingPageContent.create({
        key: 'main_cms_content',
        live: { ...defaultLandingPageContent, status: 'published' },
        draft: { ...defaultLandingPageContent, status: 'draft' },
        history: [],
      });
    }
    return doc.live || defaultLandingPageContent;
  },

  async getDraft() {
    let doc = await LandingPageContent.findOne({ key: 'main_cms_content' });
    if (!doc) {
      doc = await LandingPageContent.create({
        key: 'main_cms_content',
        live: { ...defaultLandingPageContent, status: 'published' },
        draft: { ...defaultLandingPageContent, status: 'draft' },
        history: [],
      });
    }
    return doc.draft || doc.live || defaultLandingPageContent;
  },

  async saveDraft(content) {
    const updatedDraft = {
      ...content,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };

    let doc = await LandingPageContent.findOne({ key: 'main_cms_content' });
    if (!doc) {
      doc = new LandingPageContent({
        key: 'main_cms_content',
        live: { ...defaultLandingPageContent, status: 'published' },
        draft: updatedDraft,
        history: [],
      });
    } else {
      doc.draft = updatedDraft;
      doc.markModified('draft');
    }

    await doc.save();
    return updatedDraft;
  },

  async publish() {
    let doc = await LandingPageContent.findOne({ key: 'main_cms_content' });
    if (!doc) {
      doc = new LandingPageContent({
        key: 'main_cms_content',
        live: { ...defaultLandingPageContent, status: 'published' },
        draft: { ...defaultLandingPageContent, status: 'draft' },
        history: [],
      });
    }

    const draftToPublish = doc.draft || defaultLandingPageContent;
    const published = {
      ...draftToPublish,
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    doc.live = published;
    doc.draft = published;
    doc.history = doc.history || [];
    doc.history.unshift({
      publishedAt: published.publishedAt,
      summary: 'Published landing page update',
    });
    if (doc.history.length > 20) {
      doc.history = doc.history.slice(0, 20);
    }

    doc.markModified('live');
    doc.markModified('draft');
    doc.markModified('history');
    await doc.save();

    return published;
  },

  async resetToDefaults() {
    let doc = await LandingPageContent.findOne({ key: 'main_cms_content' });
    const initialData = {
      live: { ...defaultLandingPageContent, status: 'published' },
      draft: { ...defaultLandingPageContent, status: 'draft' },
      history: [],
    };

    if (!doc) {
      doc = await LandingPageContent.create({
        key: 'main_cms_content',
        ...initialData,
      });
    } else {
      doc.live = initialData.live;
      doc.draft = initialData.draft;
      doc.history = [];
      doc.markModified('live');
      doc.markModified('draft');
      doc.markModified('history');
      await doc.save();
    }

    return doc.live;
  },
};
