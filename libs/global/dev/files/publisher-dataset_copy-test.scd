<?xml version="1.0" encoding="UTF-8"?>
<SCL version="2007" revision="B" release="4">
  <IED name="SRC">
    <Services>
      <ConfDataSet max="15" maxAttributes="15"/>
    </Services>
    <AccessPoint>
      <Server>
        <LDevice inst="ldInst1">
          <LN0 lnClass="LLN0" inst="" lnType="LLN0">
            <DataSet name="reviewLln0Invalid">
              <FCDA ldInst="ldInst1" lnClass="LLN0" doName="Beh" daName="stVal" fc="ST"/>
              <FCDA ldInst="ldInst1" lnClass="LLN0" doName="Beh" daName="q" fc="MX"/>
              <FCDA ldInst="ldInst1" lnClass="LLN0" lnInst="" doName="Beh" fc="ST"/>
              <FCDA ldInst="ldInst1" lnClass="MMXU" lnInst="1" doName="PhV.phsA" daName="cVal.mag.f" fc="MX"/>
              <FCDA ldInst="ldInst1" lnClass="MMXU" lnInst="1" doName="PhV" fc="MX"/>
              <FCDA ldInst="ldInst1" lnClass="MMXU" lnInst="1" doName="PhV" fc="ST"/>
            </DataSet>
            <DataSet name="reviewLln1">
              <FCDA ldInst="ldInst1" lnClass="LLN0" doName="Beh" daName="stVal" fc="ST"/>
              <FCDA ldInst="ldInst1" lnClass="LLN0" doName="Beh" daName="q" fc="ST"/>
              <FCDA ldInst="ldInst1" lnClass="MMXU" lnInst="1" doName="PhV.phsA" daName="cVal.mag.f" fc="MX"/>
              <FCDA ldInst="ldInst1" lnClass="MMXU" lnInst="1" doName="PhV.phsA" fc="MX"/>
              <FCDA ldInst="ldInst1" lnClass="LLN0" lnInst="" doName="Beh" fc="ST"/>
            </DataSet>
          </LN0>
          <LN prefix="" lnClass="MMXU" inst="1" lnType="MMXU"/>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="OK">
    <Services>
      <ConfDataSet max="15" maxAttributes="15"/>
    </Services>
    <AccessPoint>
      <Server>
        <LDevice inst="ldInst1">
          <LN0 lnClass="LLN0" inst="" lnType="LLN0"/>
          <LN prefix="" lnClass="MMXU" inst="1" lnType="MMXU"/>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="NoInst">
    <Services>
      <ConfDataSet max="15" maxAttributes="15"/>
    </Services>
    <AccessPoint>
      <Server>
        <LDevice inst="ldInst1">
          <LN0 lnClass="LLN0" lnType="LLN0"/>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="WrongInst">
    <Services>
      <ConfDataSet max="15" maxAttributes="15"/>
    </Services>
    <AccessPoint>
      <Server>
        <LDevice inst="ldInst1">
          <LN0 lnClass="LLN0" inst="1" lnType="LLN0"/>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <IED name="LogicalNodeMissing">
    <Services>
      <ConfDataSet max="15" maxAttributes="15"/>
    </Services>
    <AccessPoint>
      <Server>
        <LDevice inst="ldInst1">
          <LN0 lnClass="LLN0" inst="" lnType="LLN0"/>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
  <DataTypeTemplates>
    <LNodeType lnClass="LLN0" id="LLN0">
      <DO name="Beh" type="ENS"/>
    </LNodeType>
    <LNodeType lnClass="MMXU" id="MMXU">
      <DO name="PhV" type="WYE"/>
    </LNodeType>
    <DOType id="ENS" cdc="ENS">
      <DA name="stVal" fc="ST" bType="Enum"/>
      <DA name="q" fc="ST" bType="Quality"/>
    </DOType>
    <DOType id="WYE" cdc="WYE">
      <SDO name="phsA" type="CMV"/>
    </DOType>
    <DOType id="CMV" cdc="CMV">
      <DA name="cVal" fc="MX" bType="Struct" type="Vector"/>
    </DOType>
    <DAType id="Vector">
      <BDA name="mag" bType="Struct" type="AnalogueValue"/>
    </DAType>
    <DAType id="AnalogueValue">
      <BDA name="f" bType="FLOAT32"/>
    </DAType>
  </DataTypeTemplates>
</SCL>