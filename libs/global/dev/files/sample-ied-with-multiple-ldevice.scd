<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" release="4" xmlns:compas="https://www.lfenergy.org/compas/extension/v1">
	<Private type="compas_scl">
		<compas:Labels/>
	</Private>
	<Header id="project"/>
	<IED name="IED1" manufacturer="OpenSCD">
    <Services>
      <ConfDataSet max="15" maxAttributes="15" />
      <ConfReportControl max="15" />
      <GOOSE max="15" />
      <SMVsc max="15" />
    </Services>
		<AccessPoint name="AP1">
			<Server>
				<Authentication/>
				<LDevice inst="DUMMY_LDEVICE">
					<LN0 lnClass="LLN0" inst="" lnType="PlaceholderLLN0"/>
				</LDevice>
				<LDevice inst="LD1">
					<LN0 lnClass="LLN0" inst="" lnType="PlaceholderLLN0"/>
				</LDevice>
			</Server>
		</AccessPoint>
	</IED>
	<DataTypeTemplates>
		<LNodeType lnClass="LLN0" id="PlaceholderLLN0">
			<DO name="Beh" type="Beh$oscd$_c6ed035c8137b35a"/>
		</LNodeType>
		<DOType cdc="ENS" id="Beh$oscd$_c6ed035c8137b35a">
			<DA name="stVal" fc="ST" dchg="true" dupd="true" bType="Enum" type="stVal$oscd$_48ba16345b8e7f5b"/>
			<DA name="q" fc="ST" qchg="true" bType="Quality"/>
			<DA name="t" fc="ST" bType="Timestamp"/>
		</DOType>
		<EnumType id="stVal$oscd$_48ba16345b8e7f5b">
			<EnumVal ord="1">on</EnumVal>
			<EnumVal ord="2">blocked</EnumVal>
			<EnumVal ord="3">test</EnumVal>
			<EnumVal ord="4">test/blocked</EnumVal>
			<EnumVal ord="5">off</EnumVal>
		</EnumType>
	</DataTypeTemplates>
</SCL>