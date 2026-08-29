const {
  getAssistantConfiguration,
  generateAssistantReply,
} = require('../services/assistantService');

exports.getCapabilities = async (_req, res) => {
  const config = getAssistantConfiguration();

  return res.json({
    success: true,
    data: {
      available: true,
      providerConfigured: config.providerConfigured,
      provider: config.providerConfigured ? config.provider : null,
      model: config.providerConfigured ? config.model : null,
      supportedLocales: config.supportedLocales,
      supportsProviderRecommendations: true,
      persistence: 'none',
    },
  });
};

exports.sendMessage = async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const locale = req.body?.locale;
  const context = req.body?.context && typeof req.body.context === 'object'
    ? req.body.context
    : {};
  const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
  const history = rawHistory
    .slice(-8)
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || '').trim().slice(0, 1200),
    }))
    .filter((item) => item.content);

  if (!message) {
    return res.status(400).json({
      success: false,
      code: 'ASSISTANT_MESSAGE_REQUIRED',
      message: 'Message is required.',
    });
  }

  if (message.length > 1200) {
    return res.status(400).json({
      success: false,
      code: 'ASSISTANT_MESSAGE_TOO_LONG',
      message: 'Message is too long.',
    });
  }

  try {
    const result = await generateAssistantReply({ message, locale, context, history });
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Assistant reply failed:', error);
    return res.status(503).json({
      success: false,
      code: 'ASSISTANT_UNAVAILABLE',
      message: 'Assistant is temporarily unavailable.',
    });
  }
};
