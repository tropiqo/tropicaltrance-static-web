---
layout: splash
title: ""
subtitle: "Built with love for all"
# tagline: "Your gateway to groove 🌴"
permalink: /
header:
  image_description: "this is image description"
  overlay_color: "#000"
  overlay_filter: "0"
  overlay_image: /assets/images/logo-brand/white-backg-transparent.png
  actions:
    - label: "Meet Trancy"
      url: "#trancy"
      class: "btn btn--primary"
show_title: false
---

{% if site.show_edibles %}
<section id="edibles" style="padding: 4rem 1rem; text-align: center; background: linear-gradient(135deg, #ff4e50, #f9d423);border-radius: 1rem; box-shadow: 0 0 30px rgba(0,0,0,0.3); margin: 2rem;">
  <img src="/assets/images/TRANCY-01.png" alt="Trancy the mascot" style="width: 150px; position: absolute; top: -60px; right: 20px; transform: rotate(-10deg);" />

  <h2 style="color: #fff; font-size: 2.5rem;">Delicious Edibles</h2>
  <p style="color: #fff; max-width: 700px; margin: 1rem auto; font-size: 1.1rem;">
    Dive into our tropical selection of THC-infused gummies — bursting with fruity flavors and a laid-back vibe.
  </p>
  <div style="display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap; margin-top: 2rem;">
    <div style="background: rgba(255,255,255,0.15); padding: 1rem; border-radius: 0.5rem; width: 250px;">
      <div style="height: 150px; background: #fff3; border-radius: 0.5rem;"></div>
      <h3 style="color: #fff; margin-top: 1rem;">Tropical Gummies</h3>
      <p style="color: #eee; font-size: 0.9rem;">Fruity, fun, and relaxing — our signature treat.</p>
    </div>

    <div style="background: rgba(255,255,255,0.15); padding: 1rem; border-radius: 0.5rem; width: 250px;">
      <div style="height: 150px; background: #fff3; border-radius: 0.5rem;"></div>
      <h3 style="color: #fff; margin-top: 1rem;">Island Mix</h3>
      <p style="color: #eee; font-size: 0.9rem;">A mixed bag of our finest tropical flavors.</p>
    </div>
  </div>
  <a href="#contact" class="btn btn--primary" style="margin-top: 1rem;">Get Notified</a>
</section>
{% endif %}

<section id="clothing" style="padding: 4rem 1rem; text-align: center; background: linear-gradient(135deg, #24c6dc, #514a9d); border-radius: 1rem; box-shadow: 0 0 30px rgba(0,0,0,0.3); margin: 2rem;">
  <h2 style="color: #fff; font-size: 2.5rem; margin-bottom: .5rem;">Clothing Line</h2>
  <p style="color: #fff; max-width: 760px; margin: 0 auto 2rem; font-size: 1.1rem;">
    Show off your chill with Tropical Trance streetwear — comfy, vibrant, unforgettable.
  </p>

  <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:1.25rem; max-width:1100px; margin:0 auto;">

    <!-- Hoodie -->
    <article style="background: rgba(255,255,255,0.12); border-radius: .75rem; overflow: hidden; backdrop-filter:saturate(140%) blur(6px); transition:transform .2s ease, box-shadow .2s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 30px rgba(0,0,0,.35)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 0 30px rgba(0,0,0,.3)';">
      <div style="aspect-ratio: 4 / 5; background:#000;">
        <img src="/assets/images/clothing/hoodie/hoodie-w-collage.png" alt="Tropical Trance Hoodie" loading="lazy"
             style="width:100%; height:100%; object-fit: cover; object-position: center; display:block;">
      </div>
      <div style="padding: 1rem; text-align: left;">
        <h3 style="color:#fff; margin:0 0 .25rem;">Hoodie</h3>
        <p style="color:#eaeaea; margin:0 0 .75rem; font-size:.95rem;">Cozy heavyweight with Trancy flair.</p>
        <a href="#" style="display:inline-block; padding:.5rem 1rem; background:#1db954; color:#000; border-radius:.5rem; text-decoration:none; font-weight:700;">View Details</a>
      </div>
    </article>

    <!-- Women’s Tee -->
    <article style="background: rgba(255,255,255,0.12); border-radius: .75rem; overflow: hidden; backdrop-filter:saturate(140%) blur(6px);">
      <div style="aspect-ratio: 4 / 5; background:#000; transition:transform .2s ease, box-shadow .2s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 30px rgba(0,0,0,.35)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 0 30px rgba(0,0,0,.3)';">
        <img src="/assets/images/clothing/shirt/shirt-woman-collage.png" alt="Women's Tropical Trance T‑Shirt" loading="lazy"
             style="width:100%; height:100%; object-fit: cover; object-position: center; display:block;">
      </div>
      <div style="padding: 1rem; text-align: left;">
        <h3 style="color:#fff; margin:0 0 .25rem;">Women’s Tee</h3>
        <p style="color:#eaeaea; margin:0 0 .75rem; font-size:.95rem;">Soft, fitted, and tropical-fresh.</p>
        <a href="#" style="display:inline-block; padding:.5rem 1rem; background:#1db954; color:#000; border-radius:.5rem; text-decoration:none; font-weight:700;">View Details</a>
      </div>
    </article>

    <!-- Men’s Sleeveless -->
    <article style="background: rgba(255,255,255,0.12); border-radius: .75rem; overflow: hidden; backdrop-filter:saturate(140%) blur(6px); ">
      <div style="aspect-ratio: 4 / 5; background:#000; transition:transform .2s ease, box-shadow .2s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 30px rgba(0,0,0,.35)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 0 30px rgba(0,0,0,.3)';  ">
        <img src="/assets/images/clothing/sleeveless/sleeveless-man-collage.png" alt="Men’s Sleeveless Tropical Trance Shirt" loading="lazy"
             style="width:100%; height:100%; object-fit: cover; object-position: center; display:block;">
      </div>
      <div style="padding: 1rem; text-align: left;">
        <h3 style="color:#fff; margin:0 0 .25rem;">Men’s Sleeveless</h3>
        <p style="color:#eaeaea; margin:0 0 .75rem; font-size:.95rem;">Breezy gym‑ready comfort, island style.</p>
        <a href="#" style="display:inline-block; padding:.5rem 1rem; background:#1db954; color:#000; border-radius:.5rem; text-decoration:none; font-weight:700;">View Details</a>
      </div>
    </article>
  </div>

  <!-- Optional CTA row -->
  <div style="margin-top: 2rem;">
    <a href="/contact/" class="btn btn--primary" style="margin-top: 1rem;">Wholesale & Inquiries</a>
  </div>
</section>


<section id="trancy" style="padding: 4rem 2rem; background: #000; text-align: center;">
  <h2 style="color: #fff; font-size: 2.5rem; margin-bottom: 2rem;">Meet Trancy 🌴🦎</h2>
  
  <div style="max-width: 800px; margin: 0 auto;">
    <img src="/assets/images/mascot/TRANCY-01.png" alt="Trancy the Chameleon" style="width: 300px; max-width: 100%; border-radius: 1rem; margin-bottom: 2rem;">
    <p style="color: #ccc; font-size: 1.1rem;">
      Hey there! I'm <strong>Trancy</strong> — your colorful, laid-back guide through the tropical world of flavors. 🦎  
      Stick with me and let's vibe with the most delicious gummies this side of paradise. 🌴✨
    </p>
    <a href="/about/" style="display: inline-block; margin-top: 2rem; padding: 0.75rem 1.5rem; background: #1db954; color: #000; border-radius: 0.5rem; text-decoration: none; font-weight: bold;">Learn More About Us</a>
  </div>
</section>

<section id="why-choose-us" style="padding: 4rem 2rem; background: #111; text-align: center;">
  <h2 style="color: #fff; font-size: 2.5rem; margin-bottom: 2rem;">Why Choose Tropical Trance? 🌴</h2>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; max-width: 1200px; margin: 0 auto; text-align: center;">
    
    <!-- Natural Ingredients -->
    <div style="background: #1a1a1a; padding: 2rem; border-radius: 1rem;">
      <i class="fas fa-leaf" style="font-size: 2rem; color: #1db954;"></i>
      <h3 style="color: #fff; margin-top: 1rem;">All-Natural Ingredients</h3>
      <p style="color: #ccc; font-size: 0.95rem;">Crafted with real tropical fruits and premium extracts for a pure, authentic taste.</p>
    </div>

    <!-- Lab Tested -->
    <div style="background: #1a1a1a; padding: 2rem; border-radius: 1rem;">
      <i class="fas fa-vials" style="font-size: 2rem; color: #1db954;"></i>
      <h3 style="color: #fff; margin-top: 1rem;">Lab Tested</h3>
      <p style="color: #ccc; font-size: 0.95rem;">Quality and safety you can trust — each batch is independently lab-tested.</p>
    </div>

    <!-- Handcrafted -->
    <div style="background: #1a1a1a; padding: 2rem; border-radius: 1rem;">
      <i class="fas fa-hand-sparkles" style="font-size: 2rem; color: #1db954;"></i>
      <h3 style="color: #fff; margin-top: 1rem;">Handcrafted with Love</h3>
      <p style="color: #ccc; font-size: 0.95rem;">Small-batch crafted to guarantee a premium experience in every gummy.</p>
    </div>

    <!-- Tropical Vibes -->
    <div style="background: #1a1a1a; padding: 2rem; border-radius: 1rem;">
      <i class="fas fa-umbrella-beach" style="font-size: 2rem; color: #1db954;"></i>
      <h3 style="color: #fff; margin-top: 1rem;">Tropical Vibes Only</h3>
      <p style="color: #ccc; font-size: 0.95rem;">Escape to paradise with every bite — flavor, color, and joy in every chew.</p>
    </div>

  </div>
</section>
  
