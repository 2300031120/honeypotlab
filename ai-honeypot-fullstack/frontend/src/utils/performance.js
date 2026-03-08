// Performance optimization utilities for enhanced interactions

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export const smoothScroll = (element, target, duration) => {
  const start = element.scrollTop;
  const change = target - start;
  const startTime = performance.now();

  const animateScroll = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    element.scrollTop = start + change * easeInOutCubic(progress);
    
    if (progress < 1) {
      requestAnimationFrame(animateScroll);
    }
  };

  const easeInOutCubic = (t) => {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  };

  requestAnimationFrame(animateScroll);
};

export const preloadImages = (imageUrls) => {
  imageUrls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
};

export const lazyLoadElements = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        element.classList.add('loaded');
        observer.unobserve(element);
      }
    });
  }, {
    rootMargin: '50px 0px',
    threshold: 0.1
  });

  document.querySelectorAll('.lazy-load').forEach(el => {
    observer.observe(el);
  });
};

export const optimizeAnimations = () => {
  // Reduce animations for users who prefer reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (prefersReducedMotion) {
    document.documentElement.style.setProperty('--animation-duration', '0.01ms');
    document.documentElement.style.setProperty('--transition-duration', '0.01ms');
  }
};

export const monitorPerformance = () => {
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      console.log('Page Load Time:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
    });
  }
};

// FPS counter for performance monitoring
export const createFPSCounter = () => {
  let fps = 0;
  let lastTime = performance.now();
  let frames = 0;

  const updateFPS = (currentTime) => {
    frames++;
    
    if (currentTime >= lastTime + 1000) {
      fps = Math.round((frames * 1000) / (currentTime - lastTime));
      frames = 0;
      lastTime = currentTime;
      
      // Update FPS display if element exists
      const fpsElement = document.getElementById('fps-counter');
      if (fpsElement) {
        fpsElement.textContent = `FPS: ${fps}`;
      }
    }
    
    requestAnimationFrame(updateFPS);
  };

  requestAnimationFrame(updateFPS);
  return fps;
};

// Memory usage monitoring
export const checkMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = performance.memory;
    const used = Math.round(memory.usedJSHeapSize / 1048576);
    const total = Math.round(memory.totalJSHeapSize / 1048576);
    const limit = Math.round(memory.jsHeapSizeLimit / 1048576);
    
    console.log(`Memory: ${used}MB / ${total}MB (Limit: ${limit}MB)`);
    
    return { used, total, limit };
  }
  return null;
};

// Smooth parallax effect
export const createParallaxEffect = (elements, speed = 0.5) => {
  const handleScroll = throttle(() => {
    const scrolled = window.pageYOffset;
    
    elements.forEach(element => {
      const rate = scrolled * -speed;
      element.style.transform = `translateY(${rate}px)`;
    });
  }, 16);

  window.addEventListener('scroll', handleScroll);
  return handleScroll;
};

// Magnetic button effect
export const addMagneticEffect = (button) => {
  const handleMouseMove = (e) => {
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    button.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
  };

  const handleMouseLeave = () => {
    button.style.transform = 'translate(0, 0)';
  };

  button.addEventListener('mousemove', handleMouseMove);
  button.addEventListener('mouseleave', handleMouseLeave);
  
  return () => {
    button.removeEventListener('mousemove', handleMouseMove);
    button.removeEventListener('mouseleave', handleMouseLeave);
  };
};
