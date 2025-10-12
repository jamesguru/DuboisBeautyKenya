import StarRatings from 'react-star-ratings';
import { FaMinus, FaPlus, FaHeart, FaShare, FaCheck, FaChevronLeft, FaChevronRight, FaPause, FaPlay } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';
import { userRequest } from "../requestMethods";
import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from "react-redux"
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { addProduct } from '../redux/cartRedux';
import { showAverageRating } from "../components/Ratings"
import { trackPageView, trackButtonClick, trackUserAction } from '../utils/analytics';

const Product = () => {
  const location = useLocation();
  const id = location.pathname.split("/")[2]
  const [product, setProduct] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [autoSlide, setAutoSlide] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const dispatch = useDispatch();
  const cart = useSelector((state) => state.cart)
  const user = useSelector((state) => state.user);
  const autoSlideRef = useRef(null);

  let price;

  // Analytics: Track page view
  useEffect(() => {
    trackPageView('product_detail_page');
  }, []);

  // Analytics: Track product view
  useEffect(() => {
    if (product._id) {
      trackButtonClick('product_view', {
        product_id: product._id,
        product_name: product.title,
        product_category: product.categories?.[0],
        product_price: product.discountedPrice || product.originalPrice,
        has_discount: !!product.discountedPrice,
        user_logged_in: !!user.currentUser
      });
    }
  }, [product, user.currentUser]);

  const handleQuantity = (action) => {
    const oldQuantity = quantity;
    let newQuantity;
    
    if (action === "dec") {
      newQuantity = quantity === 1 ? 1 : quantity - 1;
    } else if (action === "inc") {
      newQuantity = quantity + 1;
    }
    
    setQuantity(newQuantity);
    
    // Analytics: Track quantity change
    trackButtonClick('product_quantity_change', {
      product_id: product._id,
      product_name: product.title,
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
      change_type: action === 'inc' ? 'increase' : 'decrease'
    });
  }

  useEffect(() => {
    const getProduct = async () => {
      try {
        const res = await userRequest.get("/products/find/" + id);
        setProduct(res.data);
        
        // Analytics: Track product loaded successfully
        trackButtonClick('product_loaded', {
          product_id: res.data._id,
          product_name: res.data.title,
          images_count: res.data.img?.length || 0,
          has_discount: !!res.data.discountedPrice
        });
        
        // Set the first image as selected by default
        if (res.data.img && res.data.img.length > 0) {
          setSelectedImage(0);
        }
      } catch (error) {
        console.log(error);
        
        // Analytics: Track product load error
        trackButtonClick('product_load_error', {
          product_id: id,
          error: error.message
        });
      }
    };

    getProduct();
  }, [id]);

  // Improved auto slide functionality
  useEffect(() => {
    if (!autoSlide || !product.img || product.img.length <= 1 || isHovering) return;

    // Clear any existing interval
    if (autoSlideRef.current) {
      clearInterval(autoSlideRef.current);
    }

    // Set new interval with slower slide (6 seconds)
    autoSlideRef.current = setInterval(() => {
      setSelectedImage((prev) => (prev + 1) % product.img.length);
    }, 6000); // Change image every 6 seconds

    return () => {
      if (autoSlideRef.current) {
        clearInterval(autoSlideRef.current);
      }
    };
  }, [autoSlide, product.img, isHovering]);

  const nextImage = () => {
    if (product.img && product.img.length > 0) {
      const oldIndex = selectedImage;
      setSelectedImage((prev) => (prev + 1) % product.img.length);
      setAutoSlide(false); // Stop auto-slide when manually navigating
      
      // Analytics: Track image navigation
      trackButtonClick('product_image_navigation', {
        product_id: product._id,
        product_name: product.title,
        from_image: oldIndex,
        to_image: (oldIndex + 1) % product.img.length,
        navigation_type: 'next',
        total_images: product.img.length
      });
    }
  };

  const prevImage = () => {
    if (product.img && product.img.length > 0) {
      const oldIndex = selectedImage;
      setSelectedImage((prev) => (prev - 1 + product.img.length) % product.img.length);
      setAutoSlide(false); // Stop auto-slide when manually navigating
      
      // Analytics: Track image navigation
      trackButtonClick('product_image_navigation', {
        product_id: product._id,
        product_name: product.title,
        from_image: oldIndex,
        to_image: (oldIndex - 1 + product.img.length) % product.img.length,
        navigation_type: 'previous',
        total_images: product.img.length
      });
    }
  };

  const handleImageSelect = (index) => {
    const oldIndex = selectedImage;
    setSelectedImage(index);
    setAutoSlide(false); // Stop auto-slide when manually selecting an image
    
    // Analytics: Track image selection
    trackButtonClick('product_image_select', {
      product_id: product._id,
      product_name: product.title,
      from_image: oldIndex,
      to_image: index,
      total_images: product.img.length
    });
  };

  const toggleAutoSlide = () => {
    const newAutoSlideState = !autoSlide;
    setAutoSlide(newAutoSlideState);
    
    // Analytics: Track auto-slide toggle
    trackButtonClick('product_auto_slide_toggle', {
      product_id: product._id,
      product_name: product.title,
      new_state: newAutoSlideState ? 'enabled' : 'disabled',
      total_images: product.img?.length || 0
    });
    
    if (!newAutoSlideState) {
      // If we're turning auto-slide back on, also clear any hover state
      setIsHovering(false);
    }
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (autoSlideRef.current) {
      clearInterval(autoSlideRef.current);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    // Auto-slide will restart automatically due to useEffect dependency
  };

  const handlePrice = (
    originalPrice,
    discountedPrice,
    wholePrice,
    minimumQuantity,
    quantity
  ) => {
    if (quantity > minimumQuantity && discountedPrice) {
      discountedPrice = wholePrice;
      price = discountedPrice;
      return price;
    } else if (quantity > minimumQuantity && originalPrice) {
      originalPrice = wholePrice;
      price = originalPrice;
      return price;
    } else if (discountedPrice) {
      price = discountedPrice;
      return price;
    } else {
      price = originalPrice;
      return price;
    }
  };

  const handleAddToCart = () => {
    // Analytics: Track add to cart
    trackButtonClick('product_add_to_cart', {
      product_id: product._id,
      product_name: product.title,
      product_price: price,
      quantity: quantity,
      total_price: price * quantity,
      has_discount: !!product.discountedPrice,
      user_logged_in: !!user.currentUser
    });

    dispatch(addProduct({ ...product, quantity, price, email: 'johndoe@gmail.com' }))
    toast.success("Product added to cart successfully!", {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  }

  const toggleWishlist = () => {
    const newWishlistState = !isWishlisted;
    setIsWishlisted(newWishlistState);
    
    // Analytics: Track wishlist toggle
    trackButtonClick('product_wishlist_toggle', {
      product_id: product._id,
      product_name: product.title,
      new_state: newWishlistState ? 'added' : 'removed',
      user_logged_in: !!user.currentUser
    });
    
    toast.success(newWishlistState ? "Added to wishlist" : "Removed from wishlist");
  }

  const handleShare = () => {
    // Analytics: Track share action
    trackButtonClick('product_share', {
      product_id: product._id,
      product_name: product.title,
      share_method: 'web_share' // You can track different share methods
    });
    
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: product.desc,
        url: window.location.href,
      })
      .then(() => console.log('Successful share'))
      .catch((error) => console.log('Error sharing:', error));
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success("Product link copied to clipboard!");
    }
  }

  const handleFeatureClick = (featureType, value) => {
    // Analytics: Track feature clicks
    trackButtonClick('product_feature_click', {
      product_id: product._id,
      product_name: product.title,
      feature_type: featureType,
      feature_value: value
    });
  }

  const handleReviewInteraction = (action, reviewIndex, reviewData) => {
    // Analytics: Track review interactions
    trackButtonClick('product_review_interaction', {
      product_id: product._id,
      product_name: product.title,
      action: action,
      review_index: reviewIndex,
      reviewer: reviewData?.postedBy,
      rating: reviewData?.star
    });
  }

  // Use actual product images array
  const productImages = product.img || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Product Images */}
          <div className="flex-1">
            <div className="sticky top-28">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                {/* Main Image with Navigation */}
                <div 
                  className="relative h-96 mb-4 rounded-xl overflow-hidden group"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  {productImages.length > 0 ? (
                    <>
                      <img
                        src={productImages[selectedImage]}
                        alt={product.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-in-out"
                      />
                      
                      {/* Navigation Arrows */}
                      {productImages.length > 1 && (
                        <>
                          <button 
                            onClick={prevImage}
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-opacity-70 hover:scale-110"
                          >
                            <FaChevronLeft className="text-lg" />
                          </button>
                          <button 
                            onClick={nextImage}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-opacity-70 hover:scale-110"
                          >
                            <FaChevronRight className="text-lg" />
                          </button>
                        </>
                      )}
                      
                      {/* Image Counter */}
                      {productImages.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                          {selectedImage + 1} / {productImages.length}
                        </div>
                      )}
                      
                      {/* Auto Slide Toggle */}
                      {productImages.length > 1 && (
                        <button 
                          onClick={toggleAutoSlide}
                          className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-full text-sm hover:bg-opacity-70 transition-all duration-300 flex items-center gap-2 backdrop-blur-sm"
                        >
                          {autoSlide ? <FaPause className="text-xs" /> : <FaPlay className="text-xs" />}
                          {autoSlide ? 'Pause' : 'Play'}
                        </button>
                      )}

                      {/* Auto-slide Status Indicator */}
                      {productImages.length > 1 && autoSlide && !isHovering && (
                        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs backdrop-blur-sm">
                          Auto-sliding...
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-xl">
                      <span className="text-gray-500">No image available</span>
                    </div>
                  )}
                  
                  <button 
                    onClick={toggleWishlist}
                    className="absolute top-4 right-4 bg-white p-3 rounded-full shadow-md hover:bg-rose-50 transition-all duration-300 hover:scale-110"
                  >
                    <FaHeart className={isWishlisted ? "text-rose-600" : "text-gray-400"} />
                  </button>
                </div>
                
                {/* Thumbnail Gallery */}
                {productImages.length > 1 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Product Images ({productImages.length})</h4>
                      <span className="text-xs text-gray-500">
                        {autoSlide ? 'Auto-slide: ON' : 'Auto-slide: OFF'}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {productImages.map((img, index) => (
                        <div 
                          key={index} 
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-300 ${
                            selectedImage === index ? 'border-rose-400 shadow-md scale-105' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleImageSelect(index)}
                          onMouseEnter={() => setIsHovering(true)}
                          onMouseLeave={() => setIsHovering(false)}
                        >
                          <img 
                            src={img} 
                            alt={`${product.title} ${index + 1}`} 
                            className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                          />
                          {selectedImage === index && (
                            <div className="absolute inset-0 bg-rose-400 bg-opacity-20 border-2 border-rose-400 rounded-lg"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image Navigation Dots */}
                {productImages.length > 1 && (
                  <div className="flex justify-center mt-4 space-x-2">
                    {productImages.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => handleImageSelect(index)}
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${
                          selectedImage === index 
                            ? 'bg-rose-600 w-8' 
                            : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Product Features */}
              <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Key Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {product.concern && product.concern.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Skin Concerns</h4>
                      <div className="flex flex-wrap gap-2">
                        {product.concern.map((concern, index) => (
                          <span 
                            key={index} 
                            className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-rose-200 transition-colors"
                            onClick={() => handleFeatureClick('skin_concern', concern)}
                          >
                            {concern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {product.skintype && product.skintype.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Skin Type</h4>
                      <div className="flex flex-wrap gap-2">
                        {product.skintype.map((type, index) => (
                          <span 
                            key={index} 
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-200 transition-colors"
                            onClick={() => handleFeatureClick('skin_type', type)}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {product.categories && product.categories.length > 0 && (
                    <div className="md:col-span-2">
                      <h4 className="font-medium text-gray-700 mb-2">Categories</h4>
                      <div className="flex flex-wrap gap-2">
                        {product.categories.map((category, index) => (
                          <span 
                            key={index} 
                            className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-green-200 transition-colors"
                            onClick={() => handleFeatureClick('category', category)}
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Product Details */}
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h1 className="text-3xl font-serif font-bold text-gray-800 mb-4">
                {product.title}
              </h1>
              
              <div className="flex items-center mb-6">
                <div className="mr-4">
                  {showAverageRating(product)}
                </div>
                <span className="text-gray-500 text-sm">
                  ({product.ratings?.length || 0} reviews)
                </span>
              </div>

              <p className="text-gray-600 mb-8 leading-relaxed">
                {product.desc}
              </p>

              {/* Pricing */}
              <div className="mb-8">
                <div className="flex items-center mb-2">
                  <span className="text-3xl font-bold text-rose-700 mr-3">
                    Ksh
                    {handlePrice(
                      product.originalPrice,
                      product.discountedPrice,
                      product.wholesalePrice,
                      product?.wholesaleMinimumQuantity,
                      quantity
                    )}
                  </span>
                  {product.discountedPrice && product.originalPrice && (
                    <span className="text-lg text-gray-400 line-through">
                      Ksh{product.originalPrice}
                    </span>
                  )}
                </div>
                
                {product.discountedPrice && (
                  <span className="inline-block bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm font-medium">
                    Save Ksh{(product.originalPrice - product.discountedPrice).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Wholesale Notice */}
              {product.wholesalePrice && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-8">
                  <div className="flex items-center">
                    <FaCheck className="text-rose-600 mr-2" />
                    <span className="font-medium text-rose-700">
                      Wholesale Available: Ksh{product.wholesalePrice} for {product.wholesaleMinimumQuantity}+ items
                    </span>
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mb-8">
                <label className="block text-gray-700 font-medium mb-3">Quantity</label>
                <div className="flex items-center">
                  <button 
                    onClick={() => handleQuantity("dec")}
                    className="w-12 h-12 flex items-center justify-center bg-rose-100 text-rose-600 rounded-l-full hover:bg-rose-200 transition-colors duration-300"
                  >
                    <FaMinus />
                  </button>
                  <span className="w-16 h-12 flex items-center justify-center bg-white border-t border-b border-gray-200 text-lg font-medium">
                    {quantity}
                  </span>
                  <button 
                    onClick={() => handleQuantity("inc")}
                    className="w-12 h-12 flex items-center justify-center bg-rose-100 text-rose-600 rounded-r-full hover:bg-rose-200 transition-colors duration-300"
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>

              {/* Add to Cart Button */}
              <button 
                onClick={handleAddToCart}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-full font-semibold transition-all duration-300 transform hover:scale-[1.02] shadow-lg mb-4"
              >
                Add to Cart
              </button>

              {/* Additional Actions */}
              <div className="flex gap-4">
                <button 
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 py-3 rounded-full text-gray-700 hover:bg-gray-50 transition-colors duration-300"
                >
                  <FaShare />
                  Share
                </button>
              </div>

              {/* Product Details */}
              <div className="mt-10 pt-8 border-t border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Product Details</h3>
                
                <div className="bg-rose-50 rounded-xl p-5 mb-6">
                  <h4 className="font-medium text-rose-800 mb-3 flex items-center">
                    <FaCheck className="mr-2" />
                    What's Included
                  </h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>{product.title}</li>
                    <li>User manual</li>
                    <li>30-day satisfaction guarantee</li>
                  </ul>
                </div>

                {/* Features/Benefits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {[
                    { label: "100% Natural Ingredients", icon: "🌿" },
                    { label: "Cruelty Free", icon: "🐰" },
                    { label: "Dermatologist Tested", icon: "🔬" },
                    { label: "Vegan Formula", icon: "🌱" }
                  ].map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-center cursor-pointer hover:bg-rose-50 p-2 rounded-lg transition-colors"
                      onClick={() => handleFeatureClick('product_feature', feature.label)}
                    >
                      <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-rose-600">{feature.icon}</span>
                      </div>
                      <span className="text-gray-700">{feature.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews Section */}
              {product.ratings && product.ratings.length > 0 && (
                <div className="mt-10 pt-8 border-t border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-800 mb-6">Customer Reviews</h3>
                  
                  <div className="space-y-6">
                    {product.ratings.map((rating, index) => (
                      <div key={index} className="bg-gray-50 rounded-xl p-5">
                        <div className="flex items-center mb-3">
                          <StarRatings
                            rating={parseInt(rating.star)}
                            starDimension="18px"
                            starRatedColor="#fbbf24"
                            starSpacing="2px"
                          />
                          <span className="font-medium text-gray-800 ml-3">{rating.postedBy}</span>
                        </div>
                        <p className="text-gray-600">{rating.comment || "No comment provided"}</p>
                        
                        {/* Review Actions */}
                        <div className="mt-3 flex gap-4">
                          <button 
                            onClick={() => handleReviewInteraction('helpful', index, rating)}
                            className="text-sm text-gray-500 hover:text-rose-600 transition-colors"
                          >
                            Helpful ({Math.floor(Math.random() * 10)})
                          </button>
                          <button 
                            onClick={() => handleReviewInteraction('report', index, rating)}
                            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Product;