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
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
  red: "#DC2626",
  purple: "#8B5CF6",
  green: "#10B981",
};

interface IllustrationProps {
  width?: number;
  height?: number;
  animate?: boolean;
}

// Step 1: Create A Trip - Clean, no tap arrow
export function CreateTripIllustration({ width = 320, height = 320, animate = true }: IllustrationProps) {
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
    <Svg width={width} height={height} viewBox="0 0 320 320">
      {/* Phone frame */}
      <Rect x="25" y="10" width="270" height="300" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Status bar */}
      <SvgText x="160" y="38" fontSize="14" fill={COLORS.text} textAnchor="middle" fontWeight="600">9:41</SvgText>
      
      {/* Header */}
      <SvgText x="160" y="75" fontSize="22" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Your Trips</SvgText>
      
      {/* Empty state message */}
      <SvgText x="160" y="130" fontSize="16" fill={COLORS.textSecondary} textAnchor="middle">No trips yet</SvgText>
      
      {/* Animated "New Trip" button - no tap arrow */}
      <AnimatedG animatedProps={buttonAnimatedProps}>
        <Rect x="60" y="160" width="200" height="60" rx="14" fill={COLORS.primary} />
        <Circle cx="105" cy="190" r="16" fill="rgba(255,255,255,0.2)" />
        <Path d="M105 180 L105 200 M95 190 L115 190" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        <SvgText x="175" y="196" fontSize="20" fill="#FFFFFF" textAnchor="middle" fontWeight="600">New Trip</SvgText>
      </AnimatedG>
      
      {/* Tab bar */}
      <Rect x="35" y="265" width="250" height="35" fill={COLORS.card} />
      <Circle cx="85" cy="282" r="8" fill={COLORS.border} />
      <Circle cx="160" cy="282" r="8" fill={COLORS.primary} />
      <Circle cx="235" cy="282" r="8" fill={COLORS.border} />
    </Svg>
  );
}

// Step 2: Forward Email - Clean PDF icon, no Send button
export function ForwardEmailIllustration({ width = 320, height = 320, animate = true }: IllustrationProps) {
  const arrowProgress = useSharedValue(0);
  const toFieldOpacity = useSharedValue(0);
  const pdfOpacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      arrowProgress.value = withDelay(300, withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }));
      toFieldOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
      pdfOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    }
  }, [animate]);

  const arrowAnimatedProps = useAnimatedProps(() => ({
    opacity: arrowProgress.value,
    transform: [{ translateX: interpolate(arrowProgress.value, [0, 1], [-20, 0]) }],
  }));

  const toFieldAnimatedProps = useAnimatedProps(() => ({
    opacity: toFieldOpacity.value,
  }));

  const pdfAnimatedProps = useAnimatedProps(() => ({
    opacity: pdfOpacity.value,
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 320 320">
      {/* Phone frame */}
      <Rect x="25" y="10" width="270" height="300" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Forward email header - NO Send button */}
      <Rect x="35" y="20" width="250" height="50" fill={COLORS.card} />
      <SvgText x="160" y="52" fontSize="18" fill={COLORS.primary} fontWeight="bold" textAnchor="middle">← Forward</SvgText>
      
      {/* To field */}
      <AnimatedG animatedProps={toFieldAnimatedProps}>
        <Rect x="40" y="85" width="240" height="45" rx="8" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        <SvgText x="55" y="113" fontSize="14" fill={COLORS.textSecondary}>To:</SvgText>
        
        {/* Email address - short version that fits */}
        <Rect x="85" y="93" width="180" height="28" rx="6" fill={COLORS.primaryLight} />
        <SvgText x="175" y="112" fontSize="14" fill={COLORS.primary} fontWeight="600" textAnchor="middle">123ad@triphub.com</SvgText>
      </AnimatedG>
      
      {/* Subject field */}
      <Rect x="40" y="138" width="240" height="45" rx="8" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
      <SvgText x="55" y="166" fontSize="14" fill={COLORS.textSecondary}>Subject:</SvgText>
      <SvgText x="115" y="166" fontSize="14" fill={COLORS.text}>e-ticket confirmation</SvgText>
      
      {/* Forward arrow animation */}
      <AnimatedG animatedProps={arrowAnimatedProps}>
        <Circle cx="160" cy="210" r="26" fill={COLORS.primary} />
        <Path d="M148 210 L172 210 M164 200 L172 210 L164 220" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </AnimatedG>
      
      {/* Clean PDF Icon */}
      <AnimatedG animatedProps={pdfAnimatedProps}>
        <G transform="translate(125, 248)">
          {/* Document shape with folded corner */}
          <Path d="M0 0 L0 60 L60 60 L60 15 L45 0 Z" fill="#FFFFFF" stroke={COLORS.border} strokeWidth="1.5" />
          {/* Folded corner */}
          <Path d="M45 0 L45 15 L60 15" fill="#F0F0F0" stroke={COLORS.border} strokeWidth="1" />
          {/* PDF label bar at bottom */}
          <Rect x="5" y="42" width="50" height="14" rx="2" fill={COLORS.red} />
          <SvgText x="30" y="53" fontSize="10" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">PDF</SvgText>
          {/* Document lines */}
          <Line x1="8" y1="18" x2="38" y2="18" stroke={COLORS.border} strokeWidth="2" />
          <Line x1="8" y1="26" x2="45" y2="26" stroke={COLORS.border} strokeWidth="2" />
          <Line x1="8" y1="34" x2="32" y2="34" stroke={COLORS.border} strokeWidth="2" />
        </G>
      </AnimatedG>
    </Svg>
  );
}

// Step 3: Upload Document - Clean icons, no subtitle text
export function UploadDocumentIllustration({ width = 320, height = 320, animate = true }: IllustrationProps) {
  const cameraScale = useSharedValue(1);
  const uploadScale = useSharedValue(1);
  const orOpacity = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      cameraScale.value = withDelay(300, withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700 }),
          withTiming(1, { duration: 700 })
        ),
        -1
      ));
      
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
    <Svg width={width} height={height} viewBox="0 0 320 320">
      {/* Phone frame */}
      <Rect x="25" y="10" width="270" height="300" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="35" y="20" width="250" height="50" fill={COLORS.card} />
      <SvgText x="160" y="52" fontSize="18" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Add Document</SvgText>
      
      {/* Camera option - NO subtitle */}
      <AnimatedG animatedProps={cameraAnimatedProps}>
        <Rect x="45" y="85" width="230" height="75" rx="14" fill={COLORS.card} stroke={COLORS.primary} strokeWidth="2" />
        <Circle cx="95" cy="122" r="26" fill={COLORS.primaryLight} />
        {/* Camera icon */}
        <Rect x="81" y="113" width="28" height="20" rx="4" stroke={COLORS.primary} strokeWidth="2.5" fill="none" />
        <Circle cx="95" cy="123" r="6" stroke={COLORS.primary} strokeWidth="2.5" fill="none" />
        <Rect x="88" y="110" width="14" height="5" rx="2" fill={COLORS.primary} />
        
        <SvgText x="145" y="128" fontSize="18" fill={COLORS.text} fontWeight="600">Take Photo</SvgText>
      </AnimatedG>
      
      {/* OR divider */}
      <AnimatedG animatedProps={orAnimatedProps}>
        <Line x1="60" y1="185" x2="125" y2="185" stroke={COLORS.border} strokeWidth="2" />
        <Circle cx="160" cy="185" r="18" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
        <SvgText x="160" y="190" fontSize="13" fill={COLORS.textSecondary} textAnchor="middle" fontWeight="600">OR</SvgText>
        <Line x1="195" y1="185" x2="260" y2="185" stroke={COLORS.border} strokeWidth="2" />
      </AnimatedG>
      
      {/* Upload option - clean icon, NO subtitle */}
      <AnimatedG animatedProps={uploadAnimatedProps}>
        <Rect x="45" y="215" width="230" height="75" rx="14" fill={COLORS.card} stroke={COLORS.primary} strokeWidth="2" />
        <Circle cx="95" cy="252" r="26" fill={COLORS.primaryLight} />
        {/* Clean upload icon - box with arrow */}
        <Path d="M80 260 L80 268 L110 268 L110 260" stroke={COLORS.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M95 262 L95 240" stroke={COLORS.primary} strokeWidth="3" strokeLinecap="round" />
        <Path d="M87 248 L95 240 L103 248" stroke={COLORS.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        
        <SvgText x="145" y="258" fontSize="18" fill={COLORS.text} fontWeight="600">Upload File</SvgText>
      </AnimatedG>
    </Svg>
  );
}

// Step 4: All Details At A Glance - Simplified vertical list
export function DocumentParsedIllustration({ width = 320, height = 320, animate = true }: IllustrationProps) {
  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);
  const checkmarkScale = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      cardOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      cardScale.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.5)) }));
      checkmarkScale.value = withDelay(600, withTiming(1, { duration: 400, easing: Easing.out(Easing.back(2)) }));
    }
  }, [animate]);

  const cardAnimatedProps = useAnimatedProps(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const checkmarkAnimatedProps = useAnimatedProps(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 320 320">
      {/* Phone frame */}
      <Rect x="25" y="10" width="270" height="300" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="35" y="20" width="250" height="50" fill={COLORS.card} />
      <SvgText x="55" y="50" fontSize="16" fill={COLORS.primary}>←</SvgText>
      <SvgText x="160" y="50" fontSize="18" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Paris 2025</SvgText>
      
      {/* Flight card - simplified */}
      <AnimatedG animatedProps={cardAnimatedProps}>
        <Rect x="35" y="80" width="250" height="210" rx="14" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        
        {/* Airline header */}
        <Rect x="35" y="80" width="250" height="55" rx="14" fill={COLORS.primary} opacity="0.08" />
        <Circle cx="65" cy="107" r="18" fill={COLORS.primaryLight} />
        <SvgText x="65" y="113" fontSize="16" fill={COLORS.primary} textAnchor="middle">✈</SvgText>
        <SvgText x="95" y="102" fontSize="16" fill={COLORS.text} fontWeight="bold">United Airlines</SvgText>
        <SvgText x="95" y="120" fontSize="13" fill={COLORS.primary} fontWeight="600">UA 789</SvgText>
        
        {/* Checkmark */}
        <AnimatedG animatedProps={checkmarkAnimatedProps}>
          <Circle cx="265" cy="102" r="14" fill={COLORS.success} />
          <Path d="M259 102 L263 106 L272 97" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </AnimatedG>
        
        {/* Route - prominent */}
        <SvgText x="90" y="165" fontSize="26" fill={COLORS.text} fontWeight="bold">SFO</SvgText>
        <SvgText x="160" y="165" fontSize="18" fill={COLORS.textSecondary} textAnchor="middle">→</SvgText>
        <SvgText x="190" y="165" fontSize="26" fill={COLORS.text} fontWeight="bold">CDG</SvgText>
        
        {/* Details - VERTICAL list, simple */}
        <SvgText x="50" y="200" fontSize="13" fill={COLORS.textSecondary}>Jan 15, 2025 • 10:30 AM</SvgText>
        <SvgText x="50" y="222" fontSize="13" fill={COLORS.textSecondary}>Terminal 3 • Gate G42</SvgText>
        <SvgText x="50" y="244" fontSize="13" fill={COLORS.textSecondary}>Seat 14A • Economy</SvgText>
        
        {/* Confirmation */}
        <Rect x="50" y="260" width="220" height="20" rx="4" fill={COLORS.primaryLight} />
        <SvgText x="160" y="274" fontSize="11" fill={COLORS.primary} textAnchor="middle" fontWeight="600">Confirmation: UA-789456</SvgText>
      </AnimatedG>
    </Svg>
  );
}

// Step 5: One Click Actions - 4 colored icons, no tap button
export function ViewOriginalIllustration({ width = 320, height = 320, animate = true }: IllustrationProps) {
  const cardOpacity = useSharedValue(0);
  const icon1Opacity = useSharedValue(0);
  const icon2Opacity = useSharedValue(0);
  const icon3Opacity = useSharedValue(0);
  const icon4Opacity = useSharedValue(0);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    if (animate) {
      cardOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      
      // Staggered icon reveals
      icon1Opacity.value = withDelay(500, withTiming(1, { duration: 300 }));
      icon2Opacity.value = withDelay(700, withTiming(1, { duration: 300 }));
      icon3Opacity.value = withDelay(900, withTiming(1, { duration: 300 }));
      icon4Opacity.value = withDelay(1100, withTiming(1, { duration: 300 }));
      
      // Subtle pulse on all icons
      iconScale.value = withDelay(1400, withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1
      ));
    }
  }, [animate]);

  const cardAnimatedProps = useAnimatedProps(() => ({
    opacity: cardOpacity.value,
  }));

  const icon1Props = useAnimatedProps(() => ({ opacity: icon1Opacity.value }));
  const icon2Props = useAnimatedProps(() => ({ opacity: icon2Opacity.value }));
  const icon3Props = useAnimatedProps(() => ({ opacity: icon3Opacity.value }));
  const icon4Props = useAnimatedProps(() => ({ opacity: icon4Opacity.value }));

  return (
    <Svg width={width} height={height} viewBox="0 0 320 320">
      {/* Phone frame */}
      <Rect x="25" y="10" width="270" height="300" rx="28" fill={COLORS.background} stroke={COLORS.border} strokeWidth="2" />
      
      {/* Header */}
      <Rect x="35" y="20" width="250" height="45" fill={COLORS.card} />
      <SvgText x="55" y="48" fontSize="16" fill={COLORS.primary}>←</SvgText>
      <SvgText x="160" y="48" fontSize="16" fill={COLORS.text} textAnchor="middle" fontWeight="bold">Document Details</SvgText>
      
      {/* Document preview card */}
      <AnimatedG animatedProps={cardAnimatedProps}>
        <Rect x="40" y="72" width="240" height="80" rx="10" fill={COLORS.card} stroke={COLORS.border} strokeWidth="1" />
        <Circle cx="75" cy="112" r="18" fill={COLORS.primaryLight} />
        <Path d="M67 109 L67 120 L83 120 L83 109 L75 103 L67 109" stroke={COLORS.primary} strokeWidth="1.5" fill="none" />
        <SvgText x="102" y="102" fontSize="14" fill={COLORS.text} fontWeight="bold">Hilton Paris Opera</SvgText>
        <SvgText x="102" y="118" fontSize="11" fill={COLORS.textSecondary}>108 Rue Saint-Lazare, Paris</SvgText>
        <SvgText x="102" y="134" fontSize="11" fill={COLORS.textSecondary}>+33 1 40 08 44 44</SvgText>
      </AnimatedG>
      
      {/* Four action icons - different colors, outline style */}
      
      {/* Navigate - GREEN - outline */}
      <AnimatedG animatedProps={icon1Props}>
        <G transform="translate(45, 170)">
          <Path d="M22 2 C13 2 6 11 6 20 C6 33 22 50 22 50 C22 50 38 33 38 20 C38 11 31 2 22 2" stroke={COLORS.green} strokeWidth="3" fill="none" />
          <Circle cx="22" cy="18" r="6" stroke={COLORS.green} strokeWidth="3" fill="none" />
          <SvgText x="22" y="78" fontSize="12" fill={COLORS.text} textAnchor="middle" fontWeight="600">Navigate</SvgText>
        </G>
      </AnimatedG>
      
      {/* Call - BLUE - classic phone handset */}
      <AnimatedG animatedProps={icon2Props}>
        <G transform="translate(105, 170)">
          {/* Classic phone receiver - curved shape */}
          <Path 
            d="M8 48 C4 44 2 38 2 32 C2 26 4 20 8 16 L12 12 C14 10 18 10 20 12 L22 14 C24 16 24 20 22 22 L18 26 C16 28 16 32 18 34 L26 42 C28 44 32 44 34 42 L38 38 C40 36 44 36 46 38 L48 40 C50 42 50 46 48 48 L44 52 C40 56 34 58 28 58 C22 58 16 56 12 52 Z" 
            stroke={COLORS.primary} 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            transform="scale(0.75) translate(8, -5)"
          />
          <SvgText x="22" y="78" fontSize="12" fill={COLORS.text} textAnchor="middle" fontWeight="600">Call</SvgText>
        </G>
      </AnimatedG>
      
      {/* Email - PURPLE */}
      <AnimatedG animatedProps={icon3Props}>
        <G transform="translate(165, 170)">
          <Rect x="2" y="10" width="40" height="28" rx="4" stroke={COLORS.purple} strokeWidth="3" fill="none" />
          <Path d="M2 12 L22 26 L42 12" stroke={COLORS.purple} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <SvgText x="22" y="78" fontSize="12" fill={COLORS.text} textAnchor="middle" fontWeight="600">Email</SvgText>
        </G>
      </AnimatedG>
      
      {/* Original - RED */}
      <AnimatedG animatedProps={icon4Props}>
        <G transform="translate(225, 170)">
          <Rect x="5" y="5" width="34" height="44" rx="3" stroke={COLORS.red} strokeWidth="3" fill="none" />
          <Path d="M12 16 L32 16 M12 24 L32 24 M12 32 L26 32" stroke={COLORS.red} strokeWidth="2.5" strokeLinecap="round" />
          <SvgText x="22" y="78" fontSize="12" fill={COLORS.text} textAnchor="middle" fontWeight="600">Original</SvgText>
        </G>
      </AnimatedG>
    </Svg>
  );
}
