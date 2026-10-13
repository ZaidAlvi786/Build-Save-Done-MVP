import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { Capture, Category } from '../capture/types';
import { Button, Field, Notice, styles } from '../../lib/ui';
import { useConfirmation } from './useConfirmation';
export function ConfirmScreen({
  item,
  uid,
  onBack,
  onSaved,
}: {
  item: Capture;
  uid: string;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const model = useConfirmation(item, uid, onSaved);
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Button
        label="Back to saves"
        secondary
        disabled={model.saving}
        onPress={onBack}
      />
      <Text style={styles.eyebrow}>CHECK THE PLACE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {model.name || 'Where do you want to go?'}
      </Text>
      <Text style={styles.body}>
        {model.area || 'Add a city or area so we can find the right place.'}
      </Text>
      {item.sourceText && (
        <Text numberOfLines={3} style={styles.body}>
          Shared: {item.sourceText}
        </Text>
      )}
      {item.error && <Text style={styles.body}>{item.error}</Text>}
      {model.editing && (
        <>
          <Field
            label="Place name"
            value={model.name}
            onChangeText={model.setName}
            maxLength={200}
          />
          <Field
            label="Area or address"
            value={model.area}
            onChangeText={model.setArea}
            maxLength={500}
          />
          <Text style={styles.body}>Category</Text>
          <View style={styles.row}>
            {(
              [
                'restaurant',
                'cafe',
                'shop',
                'attraction',
                'other',
              ] as Category[]
            ).map((category) => (
              <Button
                key={category}
                label={`${model.category === category ? '✓ ' : ''}${category}`}
                secondary
                onPress={() => model.setCategory(category)}
              />
            ))}
          </View>
          <Button
            label="Find matching places"
            disabled={model.busy || !model.name.trim() || !model.area.trim()}
            onPress={() => void model.search()}
          />
        </>
      )}
      {model.busy && (
        <>
          <ActivityIndicator accessibilityLabel="Finding your place" />
          <Text style={styles.body}>Checking the place and map…</Text>
        </>
      )}
      {model.selected && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{model.selected.name}</Text>
          <Text style={styles.body}>{model.selected.address}</Text>
          {model.image && (
            <Image
              source={{ uri: model.image }}
              accessibilityLabel={`Map pin for ${model.selected.name}`}
              style={styles.map}
              resizeMode="contain"
            />
          )}
          <Text style={{ fontSize: 14, color: '#1F1F1F' }}>Google Maps</Text>
          {model.mapError && (
            <>
              <Notice>
                The map could not load. You can retry or confirm the address you
                selected.
              </Notice>
              <Button
                label="Retry map"
                secondary
                onPress={() => void model.retryMap()}
              />
              <Button
                label={
                  model.addressAcknowledged
                    ? 'Address checked'
                    : 'I checked this address'
                }
                secondary
                onPress={() => model.setAddressAcknowledged(true)}
              />
            </>
          )}
        </View>
      )}
      {model.editing &&
        model.candidates.map((candidate) => (
          <Button
            key={candidate.id}
            secondary
            label={`${model.selected?.id === candidate.id ? '✓ ' : ''}${candidate.name} · ${candidate.address}`}
            disabled={model.busy}
            onPress={() => void model.select(candidate)}
          />
        ))}
      {model.error && <Notice>{model.error}</Notice>}
      <Button
        label={model.saving ? 'Saving…' : 'Looks right'}
        disabled={
          model.busy ||
          model.saving ||
          !model.selected ||
          (!model.image && !model.addressAcknowledged)
        }
        onPress={() => void model.confirm()}
      />
      <Button
        label="Fix it"
        secondary
        disabled={model.saving}
        onPress={() => model.setEditing(true)}
      />
      <Text style={styles.body}>
        The name and area you entered will be saved after you confirm this
        location.
      </Text>
    </ScrollView>
  );
}
