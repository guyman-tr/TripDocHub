import React from "react";
import Svg, { 
  Rect, 
  Text as SvgText, 
  Circle, 
  Path, 
  G,
  Line,
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
const AnimatedG = Animated.createAnimatedComponent(G);

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
export function CreateTripIllustration({ width = 320, height = 380, animate = true }: IllustrationProps) {
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    if (animate) {
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [animate]);

  const buttonAnimatedProps = useAnimatedProps(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 320 380">
      {/* Phone frame - bigger */}
      <Rect x="35" y="15" width="250" height="350" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Status bar */}
      <SvgText x="160" y="45" fontSize="14" fill={COLORS.text} textAnchor="middle" fontWeight="600">9:41</SvgText>
      
      {/* Header */}
      <SvgText x="160" y="90" fontSize="22" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Your Trips</SvgText>
      
      {/* Empty state message */}
      <SvgText x="160" y="160" fontSize="16" fill={COLORS.textSecondary} textAnchor="middle">No trips yet</SvgText>
      <SvgText x="160" y="185" fontSize="14" fill={COLORS.textSecondary} textAnchor="middle">Create your first trip to get started</SvgText>
      
      {/* Animated "New Trip" button */}
      <AnimatedG animatedProps={buttonAnimatedProps}>
        <Rect x="75" y="210" width="170" height="56" rx="14" fill={COLORS.primary} />
        <Circle cx="115" cy="238" r="14" fill="rgba(255,255,255,0.2)" />
        <Path d="M115 230 L115 246 M107 238 L123 238" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <SvgText x="175" y="244" fontSize="18" fill="#FFFFFF" textAnchor="middle" fontWeight="600">New Trip</SvgText>
      </AnimatedG>
      
      {/* Floating hint arrow */}
      <G opacity={0.9}>
        <Path 
          d="M240 195 Q270 210 255 240" 
          stroke={COLORS.accent} 
          strokeWidth="2.5" 
          fill="none"
          strokeDasharray="5,5"
        />
        <Path d="M250 232 L255 242 L262 234" stroke={COLORS.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
      <SvgText x="275" y="188" fontSize="14" fill={COLORS.accent} fontWeight="bold">Tap here!</SvgText>
      
      {/* Tab bar */}
      <Rect x="45" y="315" width="230" height="40" fill={COLORS.card} />
      <Circle cx="90" cy="335" r="10" fill={COLORS.border} />
      <Circle cx="160" cy="335" r="10" fill={COLORS.primary} />
      <Circle cx="230" cy="335" r="10" fill={COLORS.border} />
    </Svg>
  );
}

// Step 2: Forward email to TripDocHub
export function ForwardEmailIllustration({ width = 320, height = 380, animate = true }: IllustrationProps) {
  const arrowProgress = useSharedValue(0);
  const toFieldOpacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      arrowProgress.value = withDelay(300, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));
      toFieldOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
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
    <Svg width={width} height={height} viewBox="0 0 320 380">
      {/* Phone frame */}
      <Rect x="35" y="15" width="250" height="350" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Forward email header */}
      <Rect x="45" y="25" width="230" height="55" fill={COLORS.card} />
      <SvgText x="70" y="58" fontSize="16" fill={COLORS.primary} fontWeight="600">← Forward</SvgText>
      <SvgText x="250" y="58" fontSize="16" fill={COLORS.primary} fontWeight="bold">Send</SvgText>
      
      {/* To field */}
      <AnimatedG animatedProps={toFieldAnimatedProps}>
        <Rect x="50" y="95" width="220" height="50" rx="10" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        <SvgText x="65" y="125" fontSize="14" fill={COLORS.textSecondary}>To:</SvgText>
        
        {/* Email address with highlight */}
        <Rect x="95" y="105" width="165" height="30" rx="6" fill={COLORS.primaryLight} />
        <SvgText x="105" y="125" fontSize="11" fill={COLORS.primary} fontWeight="600">trip-inbox-abc123@in.mytripdochub.com</SvgText>
      </AnimatedG>
      
      {/* Forward arrow animation */}
      <AnimatedG animatedProps={arrowAnimatedProps}>
        <Circle cx="160" cy="175" r="26" fill={COLORS.primary} />
        <Path d="M148 175 L172 175 M164 165 L172 175 L164 185" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </AnimatedG>
      
      {/* Original email preview */}
      <G opacity={0.8}>
        <Rect x="50" y="215" width="220" height="120" rx="10" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        <SvgText x="65" y="240" fontSize="11" fill={COLORS.textSecondary}>---------- Forwarded message ----------</SvgText>
        <SvgText x="65" y="260" fontSize="12" fill={COLORS.textSecondary}>From: Hilton Hotels</SvgText>
        <SvgText x="65" y="280" fontSize="12" fill={COLORS.textSecondary}>Subject: Your Reservation</SvgText>
        <SvgText x="65" y="300" fontSize="12" fill={COLORS.textSecondary}>Confirmation #HTL-892341</SvgText>
        
        {/* Attachment indicator */}
        <Rect x="65" y="310" width="80" height="20" rx="5" fill={COLORS.primaryLight} />
        <SvgText x="75" y="324" fontSize="10" fill={COLORS.primary}>📎 confirmation.pdf</SvgText>
      </G>
    </Svg>
  );
}

// Step 3: Upload or Photograph Document
export function UploadDocumentIllustration({ width = 320, height = 380, animate = true }: IllustrationProps) {
  const cameraScale = useSharedValue(1);
  const uploadScale = useSharedValue(1);
  const orOpacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      // Pulsing camera button
      cameraScale.value = withDelay(300, withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700 }),
          withTiming(1, { duration: 700 })
        ),
        -1
      ));
      
      // Pulsing upload button
      uploadScale.value = withDelay(600, withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700 }),
          withTiming(1, { duration: 700 })
        ),
        -1
      ));
      
      orOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    }
  }, [animate]);

  const cameraAnimatedProps = useAnimatedProps(() => ({
    transform: [{ scale: cameraScale.value }],
  }));

  const uploadAnimatedProps = useAnimatedProps(() => ({
    transform: [{ scale: uploadScale.value }],
  }));

  const orAnimatedProps = useAnimatedProps(() => ({
    opacity: orOpacity.value,
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 320 380">
      {/* Phone frame */}
      <Rect x="35" y="15" width="250" height="350" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="45" y="25" width="230" height="55" fill={COLORS.card} />
      <SvgText x="160" y="58" fontSize="18" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Add Document</SvgText>
      
      {/* Camera option */}
      <AnimatedG animatedProps={cameraAnimatedProps}>
        <Rect x="55" y="100" width="210" height="80" rx="12" fill={COLORS.card} stroke={COLORS.primary} strokeWidth="2" />
        <Circle cx="100" cy="140" r="24" fill={COLORS.primaryLight} />
        {/* Camera icon */}
        <Rect x="88" y="132" width="24" height="18" rx="3" stroke={COLORS.primary} strokeWidth="2" fill="none" />
        <Circle cx="100" cy="141" r="5" stroke={COLORS.primary} strokeWidth="2" fill="none" />
        <Rect x="94" y="130" width="12" height="4" rx="1" fill={COLORS.primary} />
        
        <SvgText x="140" y="135" fontSize="15" fill={COLORS.text} fontWeight="600">Take Photo</SvgText>
        <SvgText x="140" y="153" fontSize="12" fill={COLORS.textSecondary}>Photograph your document</SvgText>
      </AnimatedG>
      
      {/* OR divider */}
      <AnimatedG animatedProps={orAnimatedProps}>
        <Line x1="70" y1="210" x2="130" y2="210" stroke={COLORS.border} strokeWidth="2" />
        <Circle cx="160" cy="210" r="18" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
        <SvgText x="160" y="215" fontSize="12" fill={COLORS.textSecondary} textAnchor="middle" fontWeight="600">OR</SvgText>
        <Line x1="190" y1="210" x2="250" y2="210" stroke={COLORS.border} strokeWidth="2" />
      </AnimatedG>
      
      {/* Upload option */}
      <AnimatedG animatedProps={uploadAnimatedProps}>
        <Rect x="55" y="240" width="210" height="80" rx="12" fill={COLORS.card} stroke={COLORS.primary} strokeWidth="2" />
        <Circle cx="100" cy="280" r="24" fill={COLORS.primaryLight} />
        {/* Upload icon */}
        <Path d="M100 268 L100 290" stroke={COLORS.primary} strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M92 276 L100 268 L108 276" stroke={COLORS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M88 292 L112 292" stroke={COLORS.primary} strokeWidth="2.5" strokeLinecap="round" />
        
        <SvgText x="140" y="275" fontSize="15" fill={COLORS.text} fontWeight="600">Upload File</SvgText>
        <SvgText x="140" y="293" fontSize="12" fill={COLORS.textSecondary}>Select PDF or image</SvgText>
      </AnimatedG>
      
      {/* Tab bar */}
      <Rect x="45" y="315" width="230" height="40" fill={COLORS.card} />
    </Svg>
  );
}

// Step 4: Document parsed with annotated features
export function DocumentParsedIllustration({ width = 320, height = 380, animate = true }: IllustrationProps) {
  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);
  const annotation1Opacity = useSharedValue(0);
  const annotation2Opacity = useSharedValue(0);
  const annotation3Opacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      cardOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      cardScale.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.5)) }));
      checkmarkScale.value = withDelay(600, withTiming(1, { duration: 400, easing: Easing.out(Easing.back(2)) }));
      
      // Staggered annotation reveals
      annotation1Opacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
      annotation2Opacity.value = withDelay(1600, withTiming(1, { duration: 400 }));
      annotation3Opacity.value = withDelay(2200, withTiming(1, { duration: 400 }));
    }
  }, [animate]);

  const cardAnimatedProps = useAnimatedProps(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const checkmarkAnimatedProps = useAnimatedProps(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  const annotation1Props = useAnimatedProps(() => ({ opacity: annotation1Opacity.value }));
  const annotation2Props = useAnimatedProps(() => ({ opacity: annotation2Opacity.value }));
  const annotation3Props = useAnimatedProps(() => ({ opacity: annotation3Opacity.value }));

  return (
    <Svg width={width} height={height} viewBox="0 0 320 380">
      {/* Phone frame */}
      <Rect x="35" y="15" width="250" height="350" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="45" y="25" width="230" height="55" fill={COLORS.card} />
      <SvgText x="70" y="58" fontSize="16" fill={COLORS.primary}>←</SvgText>
      <SvgText x="160" y="58" fontSize="18" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Paris 2025</SvgText>
      
      {/* Section title */}
      <SvgText x="55" y="100" fontSize="13" fill={COLORS.textSecondary} fontWeight="600">ESSENTIAL DETAILS AT A GLANCE</SvgText>
      
      {/* Document card */}
      <AnimatedG animatedProps={cardAnimatedProps}>
        <Rect x="45" y="115" width="230" height="100" rx="14" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        
        {/* Hotel icon */}
        <Circle cx="75" cy="150" r="18" fill={COLORS.primaryLight} />
        <Path d="M67 147 L67 160 L83 160 L83 147 L75 141 L67 147" stroke={COLORS.primary} strokeWidth="2" fill="none" />
        
        {/* Hotel details */}
        <SvgText x="100" y="143" fontSize="14" fill={COLORS.text} fontWeight="bold">Hilton Paris Opera</SvgText>
        <SvgText x="100" y="160" fontSize="12" fill={COLORS.textSecondary}>Jan 15 - Jan 18, 2025</SvgText>
        <SvgText x="100" y="177" fontSize="11" fill={COLORS.textSecondary}>Conf: #HTL-892341</SvgText>
        
        {/* Success checkmark */}
        <AnimatedG animatedProps={checkmarkAnimatedProps}>
          <Circle cx="255" cy="130" r="14" fill={COLORS.success} />
          <Path d="M249 130 L253 134 L262 125" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </AnimatedG>
        
        {/* Action buttons row */}
        <G>
          {/* Location button */}
          <Circle cx="85" cy="195" r="16" fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth="2" />
          <Path d="M85 186 C79 186 75 191 75 196 C75 203 85 211 85 211 C85 211 95 203 95 196 C95 191 91 186 85 186" fill={COLORS.primary} />
          <Circle cx="85" cy="195" r="4" fill="#FFFFFF" />
          
          {/* Phone button */}
          <Circle cx="160" cy="195" r="16" fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth="2" />
          <Path d="M152 187 L152 203 C152 204 153 205 154 205 L166 205 C167 205 168 204 168 203 L168 187 C168 186 167 185 166 185 L154 185 C153 185 152 186 152 187" stroke={COLORS.primary} strokeWidth="2" fill="none" />
          <Circle cx="160" cy="201" r="2.5" fill={COLORS.primary} />
          
          {/* Email button */}
          <Circle cx="235" cy="195" r="16" fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth="2" />
          <Rect x="225" y="189" width="20" height="14" rx="2" stroke={COLORS.primary} strokeWidth="2" fill="none" />
          <Path d="M225 190 L235 198 L245 190" stroke={COLORS.primary} strokeWidth="2" fill="none" />
        </G>
      </AnimatedG>
      
      {/* Annotations with arrows */}
      <AnimatedG animatedProps={annotation1Props}>
        <Path d="M85 225 L85 245 Q85 255 75 255 L55 255" stroke={COLORS.accent} strokeWidth="2" fill="none" strokeDasharray="4,3" />
        <Circle cx="50" cy="255" r="4" fill={COLORS.accent} />
        <Rect x="20" y="265" width="100" height="24" rx="6" fill={COLORS.accent} />
        <SvgText x="70" y="281" fontSize="10" fill="#FFFFFF" textAnchor="middle" fontWeight="600">Navigate to location</SvgText>
      </AnimatedG>
      
      <AnimatedG animatedProps={annotation2Props}>
        <Path d="M160 225 L160 270" stroke={COLORS.accent} strokeWidth="2" fill="none" strokeDasharray="4,3" />
        <Circle cx="160" cy="275" r="4" fill={COLORS.accent} />
        <Rect x="115" y="285" width="90" height="24" rx="6" fill={COLORS.accent} />
        <SvgText x="160" y="301" fontSize="10" fill="#FFFFFF" textAnchor="middle" fontWeight="600">Click to call</SvgText>
      </AnimatedG>
      
      <AnimatedG animatedProps={annotation3Props}>
        <Path d="M235 225 L235 245 Q235 255 245 255 L265 255" stroke={COLORS.accent} strokeWidth="2" fill="none" strokeDasharray="4,3" />
        <Circle cx="270" cy="255" r="4" fill={COLORS.accent} />
        <Rect x="200" y="265" width="100" height="24" rx="6" fill={COLORS.accent} />
        <SvgText x="250" y="281" fontSize="10" fill="#FFFFFF" textAnchor="middle" fontWeight="600">Click to email</SvgText>
      </AnimatedG>
    </Svg>
  );
}

// Step 5: Click to view original document
export function ViewOriginalIllustration({ width = 320, height = 380, animate = true }: IllustrationProps) {
  const docScale = useSharedValue(0.3);
  const docOpacity = useSharedValue(0);
  const tapIndicator = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      docOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      docScale.value = withDelay(200, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.3)) }));
      
      // Pulsing tap indicator
      tapIndicator.value = withDelay(800, withRepeat(
        withSequence(
          withTiming(1.2, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1
      ));
    }
  }, [animate]);

  const docAnimatedProps = useAnimatedProps(() => ({
    opacity: docOpacity.value,
    transform: [{ scale: docScale.value }],
  }));

  const tapAnimatedProps = useAnimatedProps(() => ({
    transform: [{ scale: tapIndicator.value }],
    opacity: interpolate(tapIndicator.value, [1, 1.2], [0.8, 0.4]),
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 320 380">
      {/* Phone frame */}
      <Rect x="35" y="15" width="250" height="350" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="45" y="25" width="230" height="55" fill={COLORS.card} />
      <SvgText x="70" y="58" fontSize="16" fill={COLORS.primary}>← Close</SvgText>
      <SvgText x="160" y="58" fontSize="16" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Original Document</SvgText>
      
      {/* PDF Document preview */}
      <AnimatedG animatedProps={docAnimatedProps}>
        <Rect x="45" y="95" width="230" height="250" rx="10" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        
        {/* PDF header */}
        <Rect x="45" y="95" width="230" height="45" rx="10" fill="#DC2626" />
        <Rect x="45" y="125" width="230" height="15" fill="#DC2626" />
        <SvgText x="160" y="123" fontSize="16" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">HILTON</SvgText>
        
        {/* Document content mockup */}
        <SvgText x="65" y="165" fontSize="14" fill={COLORS.text} fontWeight="bold">Reservation Confirmation</SvgText>
        
        <Rect x="65" y="180" width="130" height="10" rx="3" fill={COLORS.border} />
        <Rect x="65" y="196" width="180" height="8" rx="3" fill={COLORS.border} />
        <Rect x="65" y="210" width="150" height="8" rx="3" fill={COLORS.border} />
        
        <SvgText x="65" y="240" fontSize="13" fill={COLORS.text} fontWeight="600">Guest: John Doe</SvgText>
        <SvgText x="65" y="260" fontSize="12" fill={COLORS.textSecondary}>Check-in: Jan 15, 2025</SvgText>
        <SvgText x="65" y="280" fontSize="12" fill={COLORS.textSecondary}>Check-out: Jan 18, 2025</SvgText>
        <SvgText x="65" y="300" fontSize="12" fill={COLORS.textSecondary}>Room: Deluxe King</SvgText>
        
        {/* Barcode mockup */}
        <Rect x="65" y="315" width="100" height="25" rx="3" fill={COLORS.text} />
        <G>
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90].map((x, i) => (
            <Rect key={i} x={68 + x} y="318" width={i % 3 === 0 ? 2.5 : 1.5} height="19" fill="#FFFFFF" />
          ))}
        </G>
      </AnimatedG>
      
      {/* Tap indicator */}
      <AnimatedG animatedProps={tapAnimatedProps}>
        <Circle cx="160" cy="220" r="35" fill="none" stroke={COLORS.primary} strokeWidth="3" strokeDasharray="8,6" />
      </AnimatedG>
      
      {/* Tap hint */}
      <G opacity={0.9}>
        <SvgText x="160" y="370" fontSize="12" fill={COLORS.textSecondary} textAnchor="middle">Tap document to view full size</SvgText>
      </G>
    </Svg>
  );
}
