<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B">
  <Header id="weidmueller-poc" />
  <IED name="IED_A" manufacturer="Weidmueller" type="Protection">
    <AccessPoint name="P1"><Server><LDevice inst="PROT">
      <LN0 lnClass="LLN0" inst="" lnType="LLN0_TYPE">
        <Inputs>
          <ExtRef intAddr="X1/1" serviceType="GOOSE" srcIEDName="IED_B" srcLDInst="CTRL" srcLNClass="CILO" srcLNInst="1" doName="EnaOpn" daName="stVal" />
          <ExtRef intAddr="X1/2" serviceType="Report" srcIEDName="IED_B" srcLDInst="MEAS" srcLNClass="MMXU" srcLNInst="1" doName="A" />
        </Inputs>
      </LN0>
      <LN prefix="Q1" lnClass="PTOC" inst="1" lnType="PTOC_TYPE" />
      <LN lnClass="XCBR" inst="1" lnType="XCBR_TYPE" />
    </LDevice></Server></AccessPoint>
  </IED>
  <IED name="IED_B" manufacturer="Weidmueller" type="Control">
    <AccessPoint name="P1"><Server><LDevice inst="CTRL">
      <LN0 lnClass="LLN0" inst="" lnType="LLN0_TYPE" />
      <LN lnClass="CILO" inst="1" lnType="CILO_TYPE" />
    </LDevice></Server></AccessPoint>
  </IED>
  <DataTypeTemplates>
    <LNodeType id="LLN0_TYPE" lnClass="LLN0"><DO name="Mod" type="INC" /><DO name="Beh" type="INS" /></LNodeType>
    <LNodeType id="PTOC_TYPE" lnClass="PTOC"><DO name="Str" type="ACD" /><DO name="Op" type="ACT" /></LNodeType>
    <LNodeType id="XCBR_TYPE" lnClass="XCBR"><DO name="Pos" type="DPC" /><DO name="BlkOpn" type="SPC" /></LNodeType>
    <LNodeType id="CILO_TYPE" lnClass="CILO"><DO name="EnaOpn" type="SPS" /><DO name="EnaCls" type="SPS" /></LNodeType>
  </DataTypeTemplates>
</SCL>
