/**
 * Add to closet — the make-or-break flow. The user snaps/picks a photo and
 * Claude vision pre-fills every attribute, so confirming an item is a few taps
 * instead of a form slog. Without an API key the form still works fully manual.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ChipSelect, SectionLabel, Stepper } from '@/components/ui';
import { isClaudeConfigured } from '@/config';
import { tagClothingImage } from '@/services/claude';
import { useCloset } from '@/store/closet';
import { colors, font, radius, space } from '@/theme';
import type { Category, Formality, Occasion, Warmth } from '@/types';
import { CATEGORIES, OCCASIONS } from '@/types';

const FORMALITY_LABELS = { 1: 'Very casual', 2: 'Casual', 3: 'Smart', 4: 'Dressy', 5: 'Black tie' };
const WARMTH_LABELS = { 1: 'Very light', 2: 'Light', 3: 'Medium', 4: 'Warm', 5: 'Heavy' };

export default function AddItemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useCloset();

  const [imageUri, setImageUri] = useState<string | undefined>();
  const [tagging, setTagging] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('top');
  const [subtype, setSubtype] = useState('');
  const [colorsText, setColorsText] = useState('');
  const [brand, setBrand] = useState('');
  const [formality, setFormality] = useState<Formality>(3);
  const [warmth, setWarmth] = useState<Warmth>(2);
  const [occasions, setOccasions] = useState<Occasion[]>(['casual']);

  const autoTag = async (uri: string, base64?: string) => {
    if (!isClaudeConfigured() || !base64) return;
    setTagging(true);
    setTagError(null);
    try {
      const mediaType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const inferred = await tagClothingImage(base64, mediaType);
      setName(inferred.name);
      setCategory(inferred.category);
      setSubtype(inferred.subtype ?? '');
      setColorsText(inferred.colors.join(', '));
      setBrand(inferred.brand ?? '');
      setFormality(inferred.formality);
      setWarmth(inferred.warmth);
      setOccasions(inferred.occasions);
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Could not auto-tag');
    } finally {
      setTagging(false);
    }
  };

  const pickFrom = async (source: 'camera' | 'library') => {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    };
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setTagError('Permission denied. Enable camera/photos access in settings.');
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    autoTag(asset.uri, asset.base64 ?? undefined);
  };

  const toggleOccasion = (o: Occasion) => {
    setOccasions((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));
  };

  const canSave = name.trim().length > 0 && occasions.length > 0;

  const save = () => {
    if (!canSave) return;
    const colorsArr = colorsText
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    addItem({
      name: name.trim(),
      category,
      subtype: subtype.trim() || undefined,
      colors: colorsArr,
      brand: brand.trim() || undefined,
      formality,
      warmth,
      occasions,
      imageUri,
      source: 'manual',
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo + capture */}
        <View style={styles.photoBox}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, styles.photoEmpty]}>
              <Ionicons name="shirt-outline" size={40} color={colors.textFaint} />
              <Text style={font.caption}>Add a photo to auto-tag</Text>
            </View>
          )}
          {tagging ? (
            <View style={styles.tagging}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[font.caption, { color: colors.text }]}>Identifying garment…</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.captureRow}>
          <Button label="Camera" icon="camera" variant="secondary" onPress={() => pickFrom('camera')} style={styles.flex} />
          <Button label="Library" icon="images" variant="secondary" onPress={() => pickFrom('library')} style={styles.flex} />
        </View>

        {!isClaudeConfigured() ? (
          <Text style={styles.hint}>
            Add an Anthropic API key to auto-tag photos. For now, fill the details below.
          </Text>
        ) : null}
        {tagError ? <Text style={[styles.hint, { color: colors.warning }]}>{tagError}</Text> : null}

        {/* Details */}
        <View style={styles.field}>
          <SectionLabel>Name</SectionLabel>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Navy oxford shirt"
            placeholderTextColor={colors.textFaint}
          />
        </View>

        <View style={styles.field}>
          <SectionLabel>Category</SectionLabel>
          <ChipSelect
            options={CATEGORIES.map((c) => ({ id: c, label: c }))}
            selected={[category]}
            onToggle={(c) => setCategory(c)}
          />
        </View>

        <View style={styles.field}>
          <SectionLabel>Type & colors</SectionLabel>
          <TextInput
            style={styles.input}
            value={subtype}
            onChangeText={setSubtype}
            placeholder="Type, e.g. oxford shirt"
            placeholderTextColor={colors.textFaint}
          />
          <TextInput
            style={[styles.input, { marginTop: space.sm }]}
            value={colorsText}
            onChangeText={setColorsText}
            placeholder="Colors, comma-separated, e.g. navy, white"
            placeholderTextColor={colors.textFaint}
          />
        </View>

        <View style={styles.field}>
          <SectionLabel>Formality</SectionLabel>
          <Stepper value={formality} onChange={(v) => setFormality(v as Formality)} labels={FORMALITY_LABELS} />
        </View>

        <View style={styles.field}>
          <SectionLabel>Warmth</SectionLabel>
          <Stepper value={warmth} onChange={(v) => setWarmth(v as Warmth)} labels={WARMTH_LABELS} />
        </View>

        <View style={styles.field}>
          <SectionLabel>Good for</SectionLabel>
          <ChipSelect
            options={OCCASIONS.map((o) => ({ id: o.id, label: o.label }))}
            selected={occasions}
            onToggle={toggleOccasion}
            multi
          />
        </View>

        <View style={styles.field}>
          <SectionLabel>Brand (optional)</SectionLabel>
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Uniqlo"
            placeholderTextColor={colors.textFaint}
          />
        </View>

        <Button label="Save to closet" icon="checkmark" onPress={save} disabled={!canSave} style={{ marginTop: space.md }} />
        <Pressable style={styles.cancel} onPress={() => router.back()}>
          <Text style={font.bodyMuted}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  photoBox: { alignItems: 'center' },
  photo: { width: 200, height: 200, borderRadius: radius.lg, backgroundColor: colors.surface },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  tagging: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  captureRow: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  hint: { ...font.caption, lineHeight: 17 },
  field: { gap: space.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    color: colors.text,
    fontSize: 15,
  },
  cancel: { alignItems: 'center', padding: space.md },
});
