import React from "react";
import Svg, { 
  Rect, 
  Text as SvgText, 
  Circle, 
  Path, 
  G,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import Animated, { 
  useAnimatedProps, 
  useSharedValue, 
  withTiming, 
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useEffect } from "react";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Color palette
const COLORS = {
  primary: "#007AFF",
  primaryLight: "#E3F2FF",
  background: "#F8F9FA",
  card: "#FFFFFF",
  text: "#1A1A1A",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
  success: "#34C759",
  accent: "#FF9500",
};

interface IllustrationProps {
  width?: number;
  height?: number;
  animate?: boolean;
}

// Step 1: Create Your First Trip
export function CreateTripIllustration({ width = 280, height = 320, animate = true }: IllustrationProps) {
  const buttonScale = useSharedValue(1);
  const plusRotation = useSharedValue(0);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      // Pulsing button
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      
      // Plus icon subtle rotation
      plusRotation.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 600 }),
          withTiming(-5, { duration: 600 }),
          withTiming(0, { duration: 600 })
        ),
        -1
      );

      // Card fade in
      cardOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    }
  }, [animate]);

  const buttonAnimatedProps = useAnimatedProps(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 280 320">
      {/* Phone frame */}
      <Rect x="40" y="20" width="200" height="280" rx="24" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Status bar */}
      <Rect x="50" y="30" width="180" height="20" fill={COLORS.background} />
      <SvgText x="140" y="44" fontSize="11" fill={COLORS.text} textAnchor="middle" fontWeight="600">9:41</SvgText>
      
      {/* Header */}
      <SvgText x="140" y="80" fontSize="18" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Your Trips</SvgText>
      
      {/* Empty state message */}
      <SvgText x="140" y="140" fontSize="13" fill={COLORS.textSecondary} textAnchor="middle">No trips yet</SvgText>
      <SvgText x="140" y="158" fontSize="12" fill={COLORS.textSecondary} textAnchor="middle">Create your first trip to get started</SvgText>
      
      {/* Animated "New Trip" button */}
      <AnimatedG animatedProps={buttonAnimatedProps}>
        <Rect x="70" y="180" width="140" height="48" rx="12" fill={COLORS.primary} />
        <Circle cx="105" cy="204" r="12" fill="rgba(255,255,255,0.2)" />
        <Path d="M105 198 L105 210 M99 204 L111 204" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <SvgText x="155" y="209" fontSize="15" fill="#FFFFFF" textAnchor="middle" fontWeight="600">New Trip</SvgText>
      </AnimatedG>
      
      {/* Floating hint arrow */}
      <G opacity={0.8}>
        <Path 
          d="M200 170 Q220 180 210 200" 
          stroke={COLORS.accent} 
          strokeWidth="2" 
          fill="none"
          strokeDasharray="4,4"
        />
        <Path d="M205 195 L210 200 L215 193" stroke={COLORS.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
      <SvgText x="225" y="165" fontSize="11" fill={COLORS.accent} fontWeight="600">Tap here!</SvgText>
      
      {/* Tab bar */}
      <Rect x="50" y="260" width="180" height="30" fill={COLORS.card} />
      <Circle cx="85" cy="275" r="8" fill={COLORS.border} />
      <Circle cx="140" cy="275" r="8" fill={COLORS.primary} />
      <Circle cx="195" cy="275" r="8" fill={COLORS.border} />
    </Svg>
  );
}

// Step 2: Email Inbox showing booking confirmation
export function EmailInboxIllustration({ width = 280, height = 320, animate = true }: IllustrationProps) {
  const emailSlide = useSharedValue(50);
  const emailOpacity = useSharedValue(0);
  const highlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      emailOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      emailSlide.value = withDelay(200, withTiming(0, { duration: 500, easing: Easing.out(Easing.back(1.2)) }));
      highlightOpacity.value = withDelay(800, withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(0, { duration: 600 })
        ),
        -1
      ));
    }
  }, [animate]);

  const emailAnimatedProps = useAnimatedProps(() => ({
    transform: [{ translateY: emailSlide.value }],
    opacity: emailOpacity.value,
  }));

  const highlightAnimatedProps = useAnimatedProps(() => ({
    opacity: highlightOpacity.value,
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 280 320">
      {/* Email app frame */}
      <Rect x="40" y="20" width="200" height="280" rx="24" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="50" y="30" width="180" height="50" fill={COLORS.card} />
      <SvgText x="140" y="60" fontSize="16" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Inbox</SvgText>
      
      {/* Email item - highlighted */}
      <AnimatedG animatedProps={emailAnimatedProps}>
        {/* Highlight glow */}
        <AnimatedRect 
          x="52" y="88" width="176" height="72" rx="10" 
          fill={COLORS.primary}
          animatedProps={highlightAnimatedProps}
        />
        
        {/* Email card */}
        <Rect x="55" y="90" width="170" height="68" rx="8" fill={COLORS.card} stroke={COLORS.primary} strokeWidth="2" />
        
        {/* Sender avatar */}
        <Circle cx="75" cy="115" r="14" fill={COLORS.primaryLight} />
        <SvgText x="75" y="119" fontSize="12" fill={COLORS.primary} textAnchor="middle" fontWeight="bold">H</SvgText>
        
        {/* Email content */}
        <SvgText x="95" y="108" fontSize="11" fill={COLORS.text} fontWeight="600">Hilton Hotels</SvgText>
        <SvgText x="95" y="122" fontSize="10" fill={COLORS.text} fontWeight="500">Your Reservation Confirmation</SvgText>
        <SvgText x="95" y="136" fontSize="9" fill={COLORS.textSecondary}>Booking #HTL-892341 for Jan 15...</SvgText>
        
        {/* Attachment icon */}
        <Circle cx="205" cy="124" r="10" fill={COLORS.primaryLight} />
        <Path d="M202 121 L205 127 L208 121" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <Rect x="203" y="119" width="4" height="6" rx="1" fill="none" stroke={COLORS.primary} strokeWidth="1.5" />
      </AnimatedG>
      
      {/* Other emails (faded) */}
      <G opacity={0.4}>
        <Rect x="55" y="168" width="170" height="50" rx="8" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        <Circle cx="75" cy="193" r="10" fill={COLORS.border} />
        <Rect x="95" y="185" width="80" height="8" rx="2" fill={COLORS.border} />
        <Rect x="95" y="197" width="100" height="6" rx="2" fill={COLORS.border} />
      </G>
      
      <G opacity={0.3}>
        <Rect x="55" y="225" width="170" height="50" rx="8" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        <Circle cx="75" cy="250" r="10" fill={COLORS.border} />
        <Rect x="95" y="242" width="70" height="8" rx="2" fill={COLORS.border} />
        <Rect x="95" y="254" width="90" height="6" rx="2" fill={COLORS.border} />
      </G>
    </Svg>
  );
}

// Step 3: Forward email animation
export function ForwardEmailIllustration({ width = 280, height = 320, animate = true }: IllustrationProps) {
  const arrowProgress = useSharedValue(0);
  const toFieldOpacity = useSharedValue(0);
  const typingProgress = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      // Arrow animation
      arrowProgress.value = withDelay(300, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));
      
      // To field appears
      toFieldOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
      
      // Typing animation
      typingProgress.value = withDelay(900, withTiming(1, { duration: 1200, easing: Easing.linear }));
    }
  }, [animate]);

  const arrowAnimatedProps = useAnimatedProps(() => ({
    opacity: arrowProgress.value,
    transform: [{ translateX: interpolate(arrowProgress.value, [0, 1], [-20, 0]) }],
  }));

  const toFieldAnimatedProps = useAnimatedProps(() => ({
    opacity: toFieldOpacity.value,
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 280 320">
      {/* Phone frame */}
      <Rect x="40" y="20" width="200" height="280" rx="24" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Forward email header */}
      <Rect x="50" y="30" width="180" height="45" fill={COLORS.card} />
      <SvgText x="70" y="55" fontSize="14" fill={COLORS.primary} fontWeight="600">← Forward</SvgText>
      <SvgText x="210" y="55" fontSize="13" fill={COLORS.primary} fontWeight="600">Send</SvgText>
      
      {/* To field */}
      <AnimatedG animatedProps={toFieldAnimatedProps}>
        <Rect x="55" y="85" width="170" height="40" rx="8" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        <SvgText x="65" y="108" fontSize="12" fill={COLORS.textSecondary}>To:</SvgText>
        
        {/* Email address with highlight */}
        <Rect x="85" y="93" width="130" height="24" rx="4" fill={COLORS.primaryLight} />
        <SvgText x="92" y="109" fontSize="10" fill={COLORS.primary} fontWeight="500">trip-inbox-abc123</SvgText>
        <SvgText x="92" y="109" fontSize="10" fill={COLORS.primary} fontWeight="500">
          trip-inbox-abc123@in.mytripdochub.com
        </SvgText>
      </AnimatedG>
      
      {/* Forward arrow animation */}
      <AnimatedG animatedProps={arrowAnimatedProps}>
        <Circle cx="140" cy="150" r="20" fill={COLORS.primary} />
        <Path d="M132 150 L148 150 M142 144 L148 150 L142 156" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </AnimatedG>
      
      {/* Original email preview */}
      <G opacity={0.7}>
        <Rect x="55" y="180" width="170" height="90" rx="8" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        <SvgText x="65" y="200" fontSize="10" fill={COLORS.textSecondary}>---------- Forwarded message ----------</SvgText>
        <SvgText x="65" y="215" fontSize="10" fill={COLORS.textSecondary}>From: Hilton Hotels</SvgText>
        <SvgText x="65" y="230" fontSize="10" fill={COLORS.textSecondary}>Subject: Your Reservation</SvgText>
        <SvgText x="65" y="245" fontSize="10" fill={COLORS.textSecondary}>Confirmation #HTL-892341</SvgText>
        
        {/* Attachment indicator */}
        <Rect x="65" y="252" width="60" height="16" rx="4" fill={COLORS.primaryLight} />
        <SvgText x="72" y="263" fontSize="8" fill={COLORS.primary}>📎 confirmation.pdf</SvgText>
      </G>
    </Svg>
  );
}

// Step 4: Document parsed and shown in trip
export function DocumentParsedIllustration({ width = 280, height = 320, animate = true }: IllustrationProps) {
  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);
  const feature1Opacity = useSharedValue(0);
  const feature2Opacity = useSharedValue(0);
  const feature3Opacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      cardOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      cardScale.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.5)) }));
      checkmarkScale.value = withDelay(600, withTiming(1, { duration: 400, easing: Easing.out(Easing.back(2)) }));
      
      // Staggered feature highlights
      feature1Opacity.value = withDelay(1000, withRepeat(withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 })
      ), 3));
      feature2Opacity.value = withDelay(1800, withRepeat(withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 })
      ), 3));
      feature3Opacity.value = withDelay(2600, withRepeat(withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 })
      ), 3));
    }
  }, [animate]);

  const cardAnimatedProps = useAnimatedProps(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const checkmarkAnimatedProps = useAnimatedProps(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  const feature1Props = useAnimatedProps(() => ({ opacity: feature1Opacity.value }));
  const feature2Props = useAnimatedProps(() => ({ opacity: feature2Opacity.value }));
  const feature3Props = useAnimatedProps(() => ({ opacity: feature3Opacity.value }));

  return (
    <Svg width={width} height={height} viewBox="0 0 280 320">
      {/* Phone frame */}
      <Rect x="40" y="20" width="200" height="280" rx="24" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="50" y="30" width="180" height="45" fill={COLORS.card} />
      <SvgText x="70" y="55" fontSize="14" fill={COLORS.primary}>←</SvgText>
      <SvgText x="140" y="55" fontSize="15" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Paris 2025</SvgText>
      
      {/* Success checkmark */}
      <AnimatedG animatedProps={checkmarkAnimatedProps}>
        <Circle cx="140" cy="95" r="18" fill={COLORS.success} />
        <Path d="M132 95 L138 101 L150 89" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </AnimatedG>
      <SvgText x="140" y="125" fontSize="11" fill={COLORS.success} textAnchor="middle" fontWeight="600">Document Added!</SvgText>
      
      {/* Document card */}
      <AnimatedG animatedProps={cardAnimatedProps}>
        <Rect x="55" y="140" width="170" height="120" rx="12" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        
        {/* Hotel icon */}
        <Circle cx="75" cy="165" r="14" fill={COLORS.primaryLight} />
        <Path d="M69 162 L69 171 L81 171 L81 162 L75 158 L69 162" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        
        {/* Hotel details */}
        <SvgText x="95" y="160" fontSize="12" fill={COLORS.text} fontWeight="600">Hilton Paris Opera</SvgText>
        <SvgText x="95" y="174" fontSize="10" fill={COLORS.textSecondary}>Jan 15 - Jan 18, 2025</SvgText>
        <SvgText x="95" y="188" fontSize="10" fill={COLORS.textSecondary}>Conf: #HTL-892341</SvgText>
        
        {/* Action buttons row */}
        <G>
          {/* Location - implemented */}
          <AnimatedG animatedProps={feature1Props}>
            <Circle cx="85" cy="230" r="16" fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth="2" />
            <Path d="M85 222 C80 222 77 226 77 230 C77 236 85 242 85 242 C85 242 93 236 93 230 C93 226 90 222 85 222" fill={COLORS.primary} />
            <Circle cx="85" cy="229" r="3" fill="#FFFFFF" />
          </AnimatedG>
          
          {/* Phone - future */}
          <AnimatedG animatedProps={feature2Props}>
            <Circle cx="140" cy="230" r="16" fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth="2" />
            <Path d="M134 224 L134 236 C134 237 135 238 136 238 L144 238 C145 238 146 237 146 236 L146 224 C146 223 145 222 144 222 L136 222 C135 222 134 223 134 224" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
            <Circle cx="140" cy="235" r="2" fill={COLORS.primary} />
          </AnimatedG>
          
          {/* Email - future */}
          <AnimatedG animatedProps={feature3Props}>
            <Circle cx="195" cy="230" r="16" fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth="2" />
            <Rect x="187" y="225" width="16" height="11" rx="2" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
            <Path d="M187 226 L195 232 L203 226" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
          </AnimatedG>
        </G>
      </AnimatedG>
      
      {/* Feature labels */}
      <SvgText x="85" y="258" fontSize="8" fill={COLORS.textSecondary} textAnchor="middle">Navigate</SvgText>
      <SvgText x="140" y="258" fontSize="8" fill={COLORS.textSecondary} textAnchor="middle">Call</SvgText>
      <SvgText x="195" y="258" fontSize="8" fill={COLORS.textSecondary} textAnchor="middle">Email</SvgText>
    </Svg>
  );
}

// Step 5: View original document
export function ViewOriginalIllustration({ width = 280, height = 320, animate = true }: IllustrationProps) {
  const docScale = useSharedValue(0.3);
  const docOpacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      docOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      docScale.value = withDelay(200, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.3)) }));
    }
  }, [animate]);

  const docAnimatedProps = useAnimatedProps(() => ({
    opacity: docOpacity.value,
    transform: [{ scale: docScale.value }],
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 280 320">
      {/* Phone frame */}
      <Rect x="40" y="20" width="200" height="280" rx="24" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="50" y="30" width="180" height="45" fill={COLORS.card} />
      <SvgText x="70" y="55" fontSize="14" fill={COLORS.primary}>← Close</SvgText>
      <SvgText x="140" y="55" fontSize="14" fill={COLORS.text} textAnchor="middle" fontWeight="600">Original Document</SvgText>
      
      {/* PDF Document preview */}
      <AnimatedG animatedProps={docAnimatedProps}>
        <Rect x="55" y="85" width="170" height="200" rx="8" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        
        {/* PDF header */}
        <Rect x="55" y="85" width="170" height="35" rx="8" fill="#DC2626" />
        <Rect x="55" y="110" width="170" height="10" fill="#DC2626" />
        <SvgText x="140" y="107" fontSize="12" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">HILTON</SvgText>
        
        {/* Document content mockup */}
        <SvgText x="70" y="140" fontSize="11" fill={COLORS.text} fontWeight="bold">Reservation Confirmation</SvgText>
        
        <Rect x="70" y="150" width="100" height="8" rx="2" fill={COLORS.border} />
        <Rect x="70" y="162" width="140" height="6" rx="2" fill={COLORS.border} />
        <Rect x="70" y="172" width="120" height="6" rx="2" fill={COLORS.border} />
        
        <SvgText x="70" y="195" fontSize="10" fill={COLORS.text} fontWeight="600">Guest: John Doe</SvgText>
        <SvgText x="70" y="210" fontSize="10" fill={COLORS.textSecondary}>Check-in: Jan 15, 2025</SvgText>
        <SvgText x="70" y="225" fontSize="10" fill={COLORS.textSecondary}>Check-out: Jan 18, 2025</SvgText>
        <SvgText x="70" y="240" fontSize="10" fill={COLORS.textSecondary}>Room: Deluxe King</SvgText>
        
        {/* Barcode mockup */}
        <Rect x="70" y="255" width="80" height="20" rx="2" fill={COLORS.text} />
        <G>
          {[0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72].map((x, i) => (
            <Rect key={i} x={72 + x} y="257" width={i % 3 === 0 ? 2 : 1} height="16" fill="#FFFFFF" />
          ))}
        </G>
      </AnimatedG>
    </Svg>
  );
}
