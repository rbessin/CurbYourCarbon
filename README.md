# CurbYourCarbon 🌱

A browser extension that tracks the carbon footprint of your digital activities, helping you understand the environmental impact of online browsing, video streaming, and e-commerce.

## Overview

Every digital activity—from watching YouTube videos to browsing Amazon—requires energy. Data must be transmitted across networks, processed in data centers, and displayed on your device. This energy consumption translates to CO₂ emissions, and while each individual action may seem small, they add up significantly across billions of internet users worldwide.

CurbYourCarbon makes this invisible impact visible by tracking your:
- **Video streaming** (YouTube)
- **Social media browsing** (Reddit)
- **Online shopping** (Amazon)

## The Research Behind Our Calculations

### Why Carbon Tracking Matters

The global digital infrastructure consumes significant energy:
- **Data centers** account for 200 terawatt-hours of electricity annually (~0.8% of global demand)
- **Video streaming** alone represents 60-70% of global internet data traffic
- **Social media usage** contributes an estimated 262 million tonnes CO₂e per year globally

### Our Methodology

All carbon estimates in this extension are based on peer-reviewed research and industry reports. We prioritize conservative, mid-range estimates from reputable sources to provide realistic (not exaggerated) carbon footprints.

---

## Video Streaming (YouTube)

### The Research

**Primary Sources:**
- International Energy Agency (IEA) - "The carbon footprint of streaming video: fact-checking the headlines" (2020, updated 2024)
- The Carbon Trust - "Carbon impact of video streaming" white paper (2021)
- Academic research from peer-reviewed journals

**Key Finding:** Modern streaming has a carbon footprint of **approximately 36-55 grams CO₂e per hour**.

### What the Research Shows

#### Initial Misconceptions
Early estimates (2019) claimed streaming produced 1.6kg CO₂ per hour—a figure that was later corrected to 0.4kg, then further reduced to 36-55g based on better data and methodology.

#### What We Now Know
1. **Resolution Impact is Smaller Than Expected**
   - 4K streaming uses ~7GB data/hour vs 1080p's ~3GB/hour
   - But carbon difference is only ~1.2-1.5x (NOT 4x as data would suggest)
   - Why? Network infrastructure and data centers have improved dramatically

2. **Device Type Matters MORE Than Resolution**
   - 50" TV: Uses 4.5x more energy than laptop
   - Laptop: Uses 2x more energy than smartphone
   - Resolution difference: Only ~1.2x between 4K and 1080p

3. **What's Included in Estimates**
   - Data transmission across networks
   - Data center energy use (servers, cooling, etc.)
   - End-user device energy consumption
   - Global average electricity grid carbon intensity

### Our Implementation

```javascript
video: {
  "2160p": 55,   // 4K - ~7GB data/hour
  "1080p": 45,   // Full HD - ~3GB data/hour (most common)
  "720p": 40,    // HD - ~1.5GB data/hour
  "480p": 36,    // SD - ~0.6GB data/hour
  "360p": 33     // Low - ~0.3GB data/hour
}
```

**Why these numbers:**
- Based on IEA's updated 2024 estimate of 36g CO₂e/hour for standard streaming
- Scaled proportionally based on data usage per resolution
- Accounts for improved codec efficiency (H.265, VP9, AV1)

### Research Citations

1. **IEA Analysis (2024):** "Updated analysis shows 36g CO₂ per hour for 2019 streaming, down from earlier 82g estimate due to improved data center efficiency and network infrastructure."

2. **Carbon Trust (2021):** "At an individual level, the carbon footprint of viewing one hour of video-on-demand streaming (approximately 55gCO₂e in Europe) is very small compared to other everyday activities."

3. **Academic Studies:** Shehabi et al. (2014) found 420g CO₂e per hour including lifecycle emissions, but operational emissions (comparable to our scope) were 360g. With improvements since 2014, current operational emissions are ~10% of that original estimate.

---

## Social Media (Reddit)

### The Research

**Primary Source:**
- Greenspector - "What is the environmental footprint for social media applications? 2021 Edition"
- Compare the Market - Social media carbon calculator (based on Greenspector data)

**Key Finding:** Reddit produces **2.48 grams CO₂e per minute** of active scrolling.

### Methodology

Greenspector measured actual energy consumption of social media apps on a Samsung Galaxy S7 smartphone:
- Standardized 1-minute scrolling scenarios
- Measured power consumption (mAh)
- Converted to CO₂ using average global grid carbon intensity
- Tested 10 major platforms: TikTok, Reddit, Pinterest, Instagram, Snapchat, Facebook, Twitter, LinkedIn, Twitch, YouTube

### Results

| Platform | gCO₂e per minute |
|----------|------------------|
| TikTok | 2.63 |
| **Reddit** | **2.48** |
| Pinterest | 1.30 |
| Instagram | 1.05 |
| Snapchat | 0.87 |
| Facebook | 0.79 |
| LinkedIn | 0.71 |
| Twitter | 0.60 |
| Twitch | 0.55 |
| YouTube | 0.46 |

**Why Reddit is high:**
- Image-heavy content loads continuously
- Infinite scroll preloads content ahead
- Video auto-play in feed
- Real-time updates and notifications

### Our Implementation

```javascript
social: {
  reddit: 2.48,        // Grams per minute of active browsing
  imageLoad: 0.05,     // Per image loaded
  videoLoad: 0.15      // Per video loaded
}
```

### Global Impact

With 4.33 billion social media users globally:
- Combined social media use: **262 million tonnes CO₂e per year**
- Equivalent to **0.61% of global emissions**
- Comparable to Malaysia's total carbon footprint

---

## E-Commerce (Amazon)

### The Research

**Primary Sources:**
- KnownHost study on e-commerce carbon footprints (2023)
- Website Carbon Calculator methodology
- Research on digital shopping vs physical retail

**Key Finding:** Each website visit produces **~0.5 grams CO₂**, with an average online purchase involving **~7.8 page views** before buying.

### What's Measured

1. **Web Server Energy**
   - Hosting infrastructure
   - Database queries
   - Content delivery networks (CDNs)

2. **Data Transfer**
   - HTML, CSS, JavaScript files
   - Product images (thumbnails and full-resolution)
   - Product videos
   - User reviews with media

3. **End-User Device**
   - Browser rendering
   - Image/video decoding
   - Scrolling and interactions

### Findings by Component

**Website Complexity Matters:**
- Simple e-commerce sites: 0.01g CO₂ per visit (Williams Sonoma)
- Complex sites with many images: 12.18g CO₂ per visit (Casetify)
- Amazon (as a large platform): ~0.5-1g CO₂ per average page view

**Image Impact:**
- Thumbnail (search results): ~0.02g CO₂
- Standard product image: ~0.08g CO₂
- High-resolution zoom image: ~0.20g CO₂
- Product video: ~0.40g CO₂

### Our Implementation

```javascript
shopping: {
  amazon: 1.0,           // Grams per minute of active browsing
  productView: 0.5,      // Per product detail page
  productCard: 0.15,     // Per product thumbnail (search)
  imageLoad: 0.08,       // Per standard image
  highResImage: 0.20,    // Per high-res image
  videoLoad: 0.40        // Per product video
}
```

### Important Note

These estimates cover **ONLY the digital browsing experience**—not physical shipping, packaging, or manufacturing. Physical delivery adds 200-400g CO₂ per package depending on distance and method.

Research shows:
- **Online shopping** can be MORE carbon-efficient than driving to physical stores if the trip is >2km
- **Last-mile delivery** is the biggest carbon contributor in e-commerce
- **Returns** significantly increase carbon footprint (reverse logistics)

---

## What's NOT Included

To maintain accuracy and scope, our calculations **do not include:**

1. **Device Manufacturing (Embodied Carbon)**
   - Smartphone production: ~80% of lifetime emissions
   - TV production: ~33% of lifetime emissions
   - These are sunk costs independent of usage

2. **Network Infrastructure Manufacturing**
   - Cell towers, fiber optic cables, routers
   - Amortized across billions of users

3. **Content Production**
   - Video filming, editing, uploading
   - Web development and design
   - Influencer/creator device usage

4. **Physical Goods (E-commerce)**
   - Product manufacturing
   - Warehousing
   - Shipping and delivery
   - Packaging materials

5. **Regional Variations**
   - Carbon intensity varies dramatically by location
   - Iceland (renewable energy): ~18g CO₂/kWh
   - Poland (coal-heavy): ~650g CO₂/kWh
   - We use global averages: ~475g CO₂/kWh

---

## Methodology Limitations & Uncertainty

### Sources of Uncertainty

1. **Rapid Infrastructure Improvements**
   - Data centers double efficiency every 2-3 years
   - Grid carbon intensity improving with renewables
   - Network hardware becoming more efficient
   - Our estimates may be conservative (high) as a result

2. **Device Type Unknown**
   - We cannot detect if user is on phone, laptop, or TV
   - Device type has 4.5x impact on emissions
   - We use average across device types

3. **Network Type Unknown**
   - 5G uses more power than WiFi per MB
   - But adaptive streaming uses less data on mobile
   - We average across connection types

4. **User Behavior Variations**
   - Autoplay vs manual play
   - Background tabs
   - Ad-blockers (reduce image/video loading)

### Our Approach

We use **conservative mid-range estimates** from the most recent and reliable sources:
- ✅ Peer-reviewed academic research
- ✅ Industry reports from neutral organizations (IEA, Carbon Trust)
- ✅ Real-world measurements (Greenspector)
- ❌ Marketing claims from tech companies
- ❌ Sensationalized media reports
- ❌ Outdated studies (pre-2020)

---

## Comparisons & Context

### How Much is X Grams of CO₂?

To help users understand these numbers, we provide equivalencies:

**Video Streaming (1 hour at 1080p = 45g CO₂):**
- Driving 0.11 miles in a car
- Charging 5 smartphones
- 0.2% of daily per-capita emissions in developed countries

**Reddit Browsing (1 hour = 149g CO₂):**
- Driving 0.37 miles in a car
- Charging 17 smartphones
- 0.7% of daily per-capita emissions

**Amazon Shopping Session (30 min browsing, 10 products = 35g CO₂):**
- Driving 0.09 miles in a car
- Charging 4 smartphones
- **Much less than the physical delivery** (200-400g CO₂)

### Putting It In Perspective

**Average person in developed country:**
- **Total daily emissions:** ~27,000g CO₂ (27kg)
- From housing, transport, food, goods, services

**Digital activities contribution:**
- Typical user: ~1,000g CO₂/day (4% of total)
- Heavy user (4+ hrs streaming): ~2,000g CO₂/day (7% of total)

**Not the biggest impact, but worth tracking because:**
1. Easy to reduce (lower resolution, less scrolling)
2. Adds up across billions of users
3. Raises awareness about invisible digital footprint
4. Growing rapidly (unlike transport/housing)

---

## Future Improvements

As research evolves, we plan to update our methodology to include:

1. **Regional Carbon Intensity**
   - Use IP geolocation to apply local grid emissions
   - Iceland: 90% less carbon than global average
   - Germany: 40% less (renewable push)

2. **Device Detection**
   - Mobile vs desktop vs tablet
   - Adjust estimates based on actual device

3. **Time-of-Day Carbon Intensity**
   - Real-time grid data (more renewables during day)
   - Suggest lower-carbon viewing times

4. **Network Type Detection**
   - 5G vs 4G vs WiFi
   - Adjust for network efficiency

5. **Additional Platforms**
   - Netflix, Instagram, Twitter/X, TikTok
   - Email, cloud storage, video calls

---

## Research Sources

### Video Streaming
1. IEA (2024). "The carbon footprint of streaming video: fact-checking the headlines"
   - https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines

2. The Carbon Trust (2021). "Carbon impact of video streaming"
   - https://www.carbontrust.com/our-work-and-impact/guides-reports-and-tools/carbon-impact-of-video-streaming

3. Shehabi et al. (2014). "The energy and greenhouse-gas implications of internet video streaming in the United States"

4. Earth911 (2025). "What Is the Carbon Footprint of Video Streaming?"
   - https://earth911.com/home-garden/video-streaming-carbon-footprint/

### Social Media
1. Greenspector (2021). "What is the environmental footprint for social media applications? 2021 Edition"
   - https://greenspector.com/en/social-media-2021/

2. Compare the Market. "Social Carbon Footprint Calculator"
   - https://www.comparethemarket.com.au/energy/features/social-carbon-footprint-calculator/

3. The Carbon Literacy Project (2025). "The Carbon Cost of Social Media"
   - https://carbonliteracy.com/the-carbon-cost-of-social-media/

### E-Commerce
1. KnownHost (2023). "The Carbon Footprint of Your Online Shopping"
   - https://www.knownhost.com/blog/the-carbon-footprint-of-your-online-shopping/

2. Digital Commerce 360 (2023). "Data shows online retailers with the highest carbon footprints"
   - https://www.digitalcommerce360.com/2023/07/25/online-retailers-with-the-highest-carbon-footprints/

3. Environmental Science & Technology (2022). "Not All E-commerce Emits Equally"
   - https://pubs.acs.org/doi/10.1021/acs.est.2c00299

### General Digital Carbon
1. The Shift Project. "Lean ICT: Towards Digital Sobriety"
2. Borderstep Institute studies on digital energy consumption
3. OECD data on global broadband video traffic

---

## Contributing

This project is open to improvements in methodology and data sources. If you have:
- Newer research papers
- Better regional carbon intensity data
- Improved measurement techniques
- Corrections to our calculations

Please open an issue or pull request!

---

## License

MIT License - See LICENSE file for details.

---

## Acknowledgments

Special thanks to the researchers and organizations whose work made this extension possible:
- International Energy Agency
- The Carbon Trust
- Greenspector
- The Shift Project
- Borderstep Institute

And to all the academic researchers working to quantify the digital carbon footprint.
