import React, { FunctionComponent } from 'react';
import styled from 'styled-components';
import { Select, Button } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Dispatch, AnyAction } from 'redux';
import { valueChange, fieldChange, entryAdd, entryRemove } from './MessageValueViewActions';
import { getByKey } from '../../../utils/utils';
import { ProtoCtx, MessageValue, PrimitiveValue, EnumValue, ProtobufValue } from '../../../../core/protobuf/protobuf';
import HighlightInput from '../../base/HighlightInput/HighlightInput';

type ValueChangeHandler = (path: string, v: string) => void;
type FieldChangeHandler = (path: string, t: string) => void; // for oneof
type EntryAddHandler = (path: string) => void; // for repeated, map fields
type EntryRemoveHandler = (path: string) => void; // for repeated, map fields

type EventHandlers = {
  valueChange: ValueChangeHandler;
  fieldChange: FieldChangeHandler;
  entryAdd: EntryAddHandler;
  entryRemove: EntryRemoveHandler;
};

export function dispatchingHandler(dispatch: Dispatch, ctx: ProtoCtx): EventHandlers {
  function fireAndForget<T extends AnyAction>(action: T): void {
    dispatch(action);
  }

  return {
    valueChange: (p, v): void => fireAndForget(valueChange(p, v, ctx)),
    fieldChange: (p, v): void => fireAndForget(fieldChange(p, v, ctx)),
    entryAdd: (p): void => fireAndForget(entryAdd(p, ctx)),
    entryRemove: (p): void => fireAndForget(entryRemove(p, ctx)),
  };
}

function prefix(prefix: string, h: EventHandlers): EventHandlers {
  return {
    valueChange: (p, v): void => h.valueChange(`${prefix}/${p}`, v),
    fieldChange: (p, t): void => h.fieldChange(`${prefix}/${p}`, t),
    entryAdd: (p): void => h.entryAdd(`${prefix}/${p}`),
    entryRemove: (p): void => h.entryRemove(`${prefix}/${p}`),
  };
}

const KEY_INPUT_WIDTH = 200;
const SHORT_VALUE_INPUT_WIDTH = 300;
const LONG_VALUE_INPUT_WIDTH = 500;
const LONG_PRIMITIVE_TYPES = ['string', 'bytes'];

const IndentationBlock = styled('div')`
  display: block;
  margin-left: 6px;
  margin: 2px 2px 2px 10px;
  padding: 2px;
`;

const Block = styled('div')`
  display: block;
  margin: 4px 0;
  padding: 2px;
`;

const InlineBlock = styled('div')`
  display: inline;
  margin: 4px 0;
  padding: 2px;
`;

const LightText = styled('span')`
  color: gray;
`;

const FieldName = styled('span')`
  width: 50px;
`;

type MVVProps = {
  editable?: boolean;
  value: MessageValue;
  handlers: EventHandlers;
};

const MessageValueView: FunctionComponent<MVVProps> = ({ editable, value, handlers }) => {
  const { type, singleFields, repeatedFields, oneOfFields, mapFields } = value;

  return (
    <InlineBlock>
      <LightText>{type.name + ' {'}</LightText>
      <IndentationBlock>
        {singleFields.map(([fieldName, value]) => (
          <SingleFieldView
            key={fieldName}
            editable={editable}
            fieldName={fieldName}
            value={value}
            handlers={prefix(fieldName, handlers)}
          />
        ))}
        {repeatedFields.map(([fieldName, values]) => (
          <RepeatedFieldView
            key={fieldName}
            editable={editable}
            fieldName={fieldName}
            values={values}
            handlers={prefix(fieldName, handlers)}
          />
        ))}
        {oneOfFields.map(([fieldName, selectedField]) => {
          const options = getByKey(type.oneOfFields, fieldName)?.map(([name]) => name);

          return (
            <OneOfFieldView
              key={fieldName}
              editable={editable}
              fieldOptions={options || []}
              fieldName={fieldName}
              selectedField={selectedField}
              handlers={prefix(fieldName, handlers)}
            />
          );
        })}
        {mapFields.map(([fieldName, entries]) => (
          <MapFieldView
            key={fieldName}
            editable={editable}
            fieldName={fieldName}
            kvPairs={entries}
            handlers={prefix(fieldName, handlers)}
          />
        ))}
      </IndentationBlock>
      <LightText>{'}'}</LightText>
    </InlineBlock>
  );
};

type PVVProps = {
  editable?: boolean;
  value: PrimitiveValue;
  handlers: EventHandlers;
};

const PrimitiveValueView: FunctionComponent<PVVProps> = ({ editable, value, handlers }) => {
  const { type, value: v } = value;

  return (
    <HighlightInput
      size="small"
      addonAfter={<LightText>{type.name}</LightText>}
      readOnly={!editable}
      colored={editable}
      value={v}
      style={{ width: LONG_PRIMITIVE_TYPES.includes(type.name) ? LONG_VALUE_INPUT_WIDTH : SHORT_VALUE_INPUT_WIDTH }}
      onChange={(e): void => handlers.valueChange('', e.target.value)}
    />
  );
};

type EVVProps = {
  editable?: boolean;
  value: EnumValue;
  handlers: EventHandlers;
};

const EnumValueView: FunctionComponent<EVVProps> = ({ editable, value, handlers }) => {
  const { type, selected } = value;
  const { options } = type;

  const style = {
    width: SHORT_VALUE_INPUT_WIDTH,
  };

  return editable ? (
    <Select
      value={selected}
      {...(editable ? {} : { open: false })}
      style={style}
      size="small"
      onChange={(s: string): void => handlers.valueChange('', s)}
    >
      {options.map((option, idx) => (
        <Select.Option key={idx} value={option}>
          {option}
        </Select.Option>
      ))}
    </Select>
  ) : (
    <span>{selected}</span>
  );
};

type PBVVProps = {
  editable?: boolean;
  value: ProtobufValue;
  handlers: EventHandlers;
};

const ProtobufValueView: FunctionComponent<PBVVProps> = ({ editable, value, handlers }) => {
  switch (value.type.tag) {
    case 'message':
      return <MessageValueView editable={editable} value={value as MessageValue} handlers={handlers} />;
    case 'primitive':
      return <PrimitiveValueView editable={editable} value={value as PrimitiveValue} handlers={handlers} />;
    case 'enum':
      return <EnumValueView editable={editable} value={value as EnumValue} handlers={handlers} />;
  }
};

type SFVProps = {
  editable?: boolean;
  fieldName: string;
  value: ProtobufValue;
  handlers: EventHandlers;
};

const SingleFieldView: FunctionComponent<SFVProps> = ({ editable, fieldName, value, handlers }) => {
  return (
    <Block>
      <FieldName>{fieldName}</FieldName>
      <span>: </span>
      <ProtobufValueView editable={editable} value={value} handlers={handlers} />
    </Block>
  );
};

type RFVProps = {
  editable?: boolean;
  fieldName: string;
  values: ReadonlyArray<ProtobufValue>;
  handlers: EventHandlers;
};

const RepeatedFieldView: FunctionComponent<RFVProps> = ({ editable, fieldName, values, handlers }) => {
  return (
    <Block>
      <FieldName>{fieldName}</FieldName>
      <span>: </span>
      {values.map((v, idx) => (
        <IndentationBlock key={idx}>
          <ProtobufValueView editable={editable} value={v} handlers={prefix(idx.toString(), handlers)} />
          {editable ? (
            <Button
              shape="circle"
              size="small"
              danger
              style={{ marginLeft: 4 }}
              onClick={(): void => handlers.entryRemove(`${idx.toString()}/`)}
            >
              <DeleteOutlined />
            </Button>
          ) : null}
        </IndentationBlock>
      ))}
      {editable ? (
        <IndentationBlock>
          <Button shape="circle" size="small" ghost type="primary" onClick={(): void => handlers.entryAdd('')}>
            <PlusOutlined />
          </Button>
        </IndentationBlock>
      ) : null}
    </Block>
  );
};

type OFVProps = {
  editable?: boolean;
  fieldOptions: ReadonlyArray<string>;
  fieldName: string;
  selectedField: [string, ProtobufValue];
  handlers: EventHandlers;
};

const OneOfFieldView: FunctionComponent<OFVProps> = ({
  editable,
  fieldOptions,
  fieldName,
  selectedField,
  handlers,
}) => {
  const [name, value] = selectedField;
  return (
    <Block>
      <FieldName>{fieldName}</FieldName>
      <span>: </span>
      {editable && (
        <Select
          value={name}
          size="small"
          style={{ width: KEY_INPUT_WIDTH }}
          onChange={(s: string): void => handlers.fieldChange('', s)}
        >
          {fieldOptions.map((option, idx) => (
            <Select.Option key={idx} value={option}>
              {option}
            </Select.Option>
          ))}
        </Select>
      )}
      <IndentationBlock>
        <SingleFieldView editable={editable} fieldName={name} value={value} handlers={prefix(name, handlers)} />
      </IndentationBlock>
    </Block>
  );
};

type MFVProps = {
  editable?: boolean;
  fieldName: string;
  kvPairs: ReadonlyArray<[string, ProtobufValue]>;
  handlers: EventHandlers;
};

const MapFieldView: FunctionComponent<MFVProps> = ({ editable, fieldName, kvPairs, handlers }) => {
  return (
    <Block>
      <FieldName>{fieldName}</FieldName>
      <span>: </span>
      {kvPairs.map(([k, v], idx) => (
        <IndentationBlock key={idx}>
          <HighlightInput
            value={k}
            style={{ width: KEY_INPUT_WIDTH, marginRight: 4 }}
            colored={editable}
            size="small"
            onChange={(e): void => handlers.valueChange(`${idx.toString()}/0/`, e.target.value)}
          />
          <ProtobufValueView editable={editable} value={v} handlers={prefix(`${idx.toString()}/1`, handlers)} />
          {editable ? (
            <Button
              shape="circle"
              size="small"
              danger
              style={{ marginLeft: 4 }}
              onClick={(): void => handlers.entryRemove(`${idx.toString()}/`)}
            >
              <DeleteOutlined />
            </Button>
          ) : null}
        </IndentationBlock>
      ))}
      {editable ? (
        <IndentationBlock>
          <Button shape="circle" size="small" ghost type="primary" onClick={(): void => handlers.entryAdd('')}>
            <PlusOutlined />
          </Button>
        </IndentationBlock>
      ) : null}
    </Block>
  );
};

export default MessageValueView;
