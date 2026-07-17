const db = require('../config/database');
const { parseJsonArray } = require('../utils/jsonHelpers');
const {
  hasCloudinaryConfig,
  uploadImageBuffer,
  deleteImageByPublicId,
} = require('../utils/cloudinaryService');

// Create or update service profile
exports.createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { fullName, barangayAddress, startingPrice, description } = req.body;
    let serviceCategories = req.body.serviceCategories;
    let bannerImage = null;
    let bannerImageUrl = null;
    let bannerImagePublicId = null;

    // Parse serviceCategories if it's a JSON string (from FormData)
    if (typeof serviceCategories === 'string') {
      try {
        serviceCategories = JSON.parse(serviceCategories);
      } catch (e) {
        serviceCategories = [serviceCategories];
      }
    }

    // Validate required fields
    if (!fullName || !barangayAddress || !startingPrice || !serviceCategories || serviceCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Handle banner image upload if provided
    if (req.file) {
      if (hasCloudinaryConfig()) {
        const uploadResult = await uploadImageBuffer({
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          folder: 'serbisyo-toledo/service-banners',
        });

        bannerImageUrl = uploadResult.secure_url;
        bannerImagePublicId = uploadResult.public_id;
      } else {
        bannerImage = req.file.buffer;
      }
    }

    // Check if profile already exists for this user
    const [existingProfile] = await db.query(
      'SELECT id, banner_image_public_id FROM service_profiles WHERE user_id = ?',
      [userId]
    );

    if (existingProfile.length > 0) {
      // Update existing profile
      const updates = [
        'full_name = ?',
        'barangay_address = ?',
        'starting_price = ?',
        'service_categories = ?',
        'description = ?',
      ];

      const params = [
        fullName,
        barangayAddress,
        parseFloat(startingPrice),
        JSON.stringify(serviceCategories),
        description || null
      ];

      if (bannerImageUrl) {
        updates.push('banner_image_url = ?');
        params.push(bannerImageUrl);
        updates.push('banner_image_public_id = ?');
        params.push(bannerImagePublicId);
        updates.push('banner_image = NULL');
      } else if (bannerImage) {
        updates.push('banner_image = ?');
        params.push(bannerImage);
      }

      params.push(userId);

      await db.query(
        `UPDATE service_profiles SET ${updates.join(', ')} WHERE user_id = ?`,
        params
      );

      if (bannerImagePublicId && existingProfile[0].banner_image_public_id) {
        await deleteImageByPublicId(existingProfile[0].banner_image_public_id);
      }

      return res.json({
        success: true,
        message: 'Service profile updated successfully',
        profileId: existingProfile[0].id
      });
    } else {
      // Create new profile
      const [result] = await db.query(
        `INSERT INTO service_profiles 
         (user_id, full_name, barangay_address, starting_price, service_categories, description, banner_image, banner_image_url, banner_image_public_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          fullName,
          barangayAddress,
          parseFloat(startingPrice),
          JSON.stringify(serviceCategories),
          description || null,
          bannerImage,
          bannerImageUrl,
          bannerImagePublicId,
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Service profile created successfully',
        profileId: result.insertId
      });
    }
  } catch (error) {
    console.error('Error creating/updating service profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating/updating service profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all published service profiles
exports.getAllProfiles = async (req, res) => {
  try {
    const { category, location, minPrice, maxPrice, minRating, search } = req.query;

    let query = `
      SELECT 
        sp.id,
        sp.user_id,
        sp.full_name,
        sp.barangay_address,
        sp.starting_price,
        sp.service_categories,
        sp.description,
        sp.banner_image,
        sp.banner_image_url,
        sp.rating,
        sp.reviews_count,
        sp.online,
        sp.created_at,
        u.profession,
        u.skills,
        u.is_verified
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.is_published = TRUE
    `;

    const params = [];

    // Add filters
    if (location) {
      query += ' AND sp.barangay_address LIKE ?';
      params.push(`%${location}%`);
    }

    if (minPrice) {
      query += ' AND sp.starting_price >= ?';
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      query += ' AND sp.starting_price <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (minRating) {
      query += ' AND sp.rating >= ?';
      params.push(parseFloat(minRating));
    }

    if (search) {
      query += ' AND (sp.full_name LIKE ? OR u.profession LIKE ? OR u.skills LIKE ? OR sp.barangay_address LIKE ? OR sp.description LIKE ? OR sp.service_categories LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      query += ' AND JSON_CONTAINS(sp.service_categories, ?)';
      params.push(JSON.stringify(category));
    }

    query += ' ORDER BY sp.rating DESC, sp.reviews_count DESC';

    const [profiles] = await db.query(query, params);

    // Format response
    const formattedProfiles = profiles.map(profile => {
      const categories = parseJsonArray(profile.service_categories, []);
      const skills = parseJsonArray(profile.skills, []);

      return {
        id: profile.id,
        userId: profile.user_id,
        name: profile.full_name,
        location: profile.barangay_address,
        startingPrice: parseFloat(profile.starting_price),
        description: profile.description,
        image: profile.banner_image_url || (profile.banner_image ? `data:image/jpeg;base64,${Buffer.from(profile.banner_image).toString('base64')}` : null),
        tags: [...skills, ...categories],
        rating: parseFloat(profile.rating),
        reviews: profile.reviews_count,
        online: profile.online,
        verified: Boolean(profile.is_verified),
        profession: profile.profession,
        categories,
      };
    });

    res.json({
      success: true,
      data: formattedProfiles,
      count: formattedProfiles.length
    });
  } catch (error) {
    console.error('Error fetching service profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service profiles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single profile by ID
exports.getProfileById = async (req, res) => {
  try {
    const { id } = req.params;

    const [profiles] = await db.query(
      `SELECT 
        sp.*,
        u.profession,
        u.skills,
        u.email,
        u.phone,
        u.is_verified
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.id = ? AND sp.is_published = TRUE`,
      [id]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    const profile = profiles[0];

    // Fetch portfolio items
    const [portfolioItems] = await db.query(
      `SELECT id, image_url, image_data, caption, display_order 
       FROM portfolio_items 
       WHERE service_profile_id = ? 
       ORDER BY display_order ASC, created_at DESC`,
      [id]
    );

    // Fetch reviews with client names
    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name as reviewer_name
       FROM reviews r
       JOIN users u ON r.client_id = u.id
       WHERE r.service_profile_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    // Format portfolio items
    const formattedPortfolio = portfolioItems.map(item => ({
      id: item.id,
      src: item.image_url || (item.image_data ? `data:image/jpeg;base64,${Buffer.from(item.image_data).toString('base64')}` : null),
      caption: item.caption
    }));

    // Format reviews
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      reviewer: review.reviewer_name,
      date: new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      rating: review.rating,
      comment: review.comment
    }));

    const categories = parseJsonArray(profile.service_categories, []);
    const skills = parseJsonArray(profile.skills, []);

    const formattedProfile = {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name,
      location: profile.barangay_address,
      startingPrice: parseFloat(profile.starting_price),
      description: profile.description,
      aboutMe: profile.about_me,
      responseTime: profile.response_time || 'Within 24 hours',
      jobsCompleted: profile.jobs_completed || 0,
      image: profile.banner_image_url || (profile.banner_image ? `data:image/jpeg;base64,${Buffer.from(profile.banner_image).toString('base64')}` : null),
      tags: [...skills, ...categories],
      rating: parseFloat(profile.rating),
      reviewsCount: profile.reviews_count,
      online: profile.online,
      verified: Boolean(profile.is_verified),
      profession: profile.profession,
      categories,
      email: profile.email,
      phone: profile.phone,
      createdAt: profile.created_at,
      portfolio: formattedPortfolio,
      reviews: formattedReviews
    };

    res.json({
      success: true,
      data: formattedProfile
    });
  } catch (error) {
    console.error('Error fetching service profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get current user's profile
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const [profiles] = await db.query(
      `SELECT 
        sp.*,
        u.profession,
        u.skills,
        u.email,
        u.phone,
        u.is_verified
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.user_id = ?`,
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'You have not created a service profile yet'
      });
    }

    const profile = profiles[0];
    const categories = parseJsonArray(profile.service_categories, []);
    const skills = parseJsonArray(profile.skills, []);

    const formattedProfile = {
      id: profile.id,
      userId: profile.user_id,
      name: profile.full_name,
      location: profile.barangay_address,
      startingPrice: parseFloat(profile.starting_price),
      description: profile.description,
      image: profile.banner_image_url || (profile.banner_image ? `data:image/jpeg;base64,${Buffer.from(profile.banner_image).toString('base64')}` : null),
      tags: [...skills, ...categories],
      rating: parseFloat(profile.rating),
      reviews: profile.reviews_count,
      online: profile.online,
      verified: Boolean(profile.is_verified),
      profession: profile.profession,
      categories,
      email: profile.email,
      phone: profile.phone,
      createdAt: profile.created_at
    };

    res.json({
      success: true,
      data: formattedProfile
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Publish/unpublish profile
exports.togglePublish = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { isPublished } = req.body;

    const [result] = await db.query(
      'UPDATE service_profiles SET is_published = ? WHERE user_id = ?',
      [isPublished, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    res.json({
      success: true,
      message: `Profile ${isPublished ? 'published' : 'unpublished'} successfully`
    });
  } catch (error) {
    console.error('Error updating profile publish status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update portfolio details (about me, skills, response time)
exports.updatePortfolioDetails = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { aboutMe, responseTime } = req.body;
    let skills = req.body.skills;

    // Parse skills if it's a string
    if (typeof skills === 'string') {
      try {
        skills = JSON.parse(skills);
      } catch (e) {
        skills = skills.split(',').map(s => s.trim());
      }
    }

    // Check if user has a service profile
    const [profiles] = await db.query(
      'SELECT id FROM service_profiles WHERE user_id = ?',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'You need to create a service profile first'
      });
    }

    // Update the profile
    await db.query(
      `UPDATE service_profiles 
       SET about_me = ?, response_time = ?
       WHERE user_id = ?`,
      [aboutMe || null, responseTime || 'Within 24 hours', userId]
    );

    // Update skills in users table
    if (skills && Array.isArray(skills)) {
      await db.query(
        'UPDATE users SET skills = ? WHERE id = ?',
        [JSON.stringify(skills), userId]
      );
    }

    res.json({
      success: true,
      message: 'Portfolio details updated successfully'
    });
  } catch (error) {
    console.error('Error updating portfolio details:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating portfolio details'
    });
  }
};

// Add portfolio image
exports.addPortfolioImage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { caption } = req.body;
    let imageData = null;
    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      if (hasCloudinaryConfig()) {
        const uploadResult = await uploadImageBuffer({
          buffer: req.file.buffer,
          mimeType: req.file.mimetype,
          folder: 'serbisyo-toledo/portfolio',
        });

        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
      } else {
        imageData = req.file.buffer;
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    // Get service profile id
    const [profiles] = await db.query(
      'SELECT id FROM service_profiles WHERE user_id = ?',
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'You need to create a service profile first'
      });
    }

    const serviceProfileId = profiles[0].id;

    // Get display order for new image
    const [orderResult] = await db.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 as nextOrder FROM portfolio_items WHERE service_profile_id = ?',
      [serviceProfileId]
    );

    const [result] = await db.query(
      `INSERT INTO portfolio_items (service_profile_id, image_url, image_public_id, image_data, caption, display_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [serviceProfileId, imageUrl, imagePublicId, imageData, caption || '', orderResult[0].nextOrder]
    );

    res.status(201).json({
      success: true,
      message: 'Portfolio image added successfully',
      data: {
        id: result.insertId,
        caption: caption || ''
      }
    });
  } catch (error) {
    console.error('Error adding portfolio image:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding portfolio image'
    });
  }
};

// Delete portfolio image
exports.deletePortfolioImage = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { imageId } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify ownership
    const [images] = await db.query(
      `SELECT pi.id, pi.image_public_id FROM portfolio_items pi
       JOIN service_profiles sp ON pi.service_profile_id = sp.id
       WHERE pi.id = ? AND sp.user_id = ?`,
      [imageId, userId]
    );

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found or not authorized'
      });
    }

    if (images[0].image_public_id) {
      await deleteImageByPublicId(images[0].image_public_id);
    }

    await db.query('DELETE FROM portfolio_items WHERE id = ?', [imageId]);

    res.json({
      success: true,
      message: 'Portfolio image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting portfolio image:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting portfolio image'
    });
  }
};

// Get full portfolio for editing
exports.getMyPortfolio = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get profile with portfolio items
    const [profiles] = await db.query(
      `SELECT 
        sp.id, sp.about_me, sp.response_time, sp.jobs_completed,
        u.skills
      FROM service_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.user_id = ?`,
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service profile not found'
      });
    }

    const profile = profiles[0];

    // Get portfolio items
    const [portfolioItems] = await db.query(
      'SELECT id, image_url, image_data, caption, display_order FROM portfolio_items WHERE service_profile_id = ? ORDER BY display_order',
      [profile.id]
    );

    const formattedPortfolio = portfolioItems.map(item => ({
      id: item.id,
      src: item.image_url || (item.image_data ? `data:image/jpeg;base64,${Buffer.from(item.image_data).toString('base64')}` : null),
      caption: item.caption
    }));

    res.json({
      success: true,
      data: {
        aboutMe: profile.about_me || '',
        responseTime: profile.response_time || 'Within 24 hours',
        jobsCompleted: profile.jobs_completed || 0,
        skills: JSON.parse(profile.skills || '[]'),
        portfolio: formattedPortfolio
      }
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio'
    });
  }
};