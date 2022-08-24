import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, Text, View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack'
import { NavigationContainer, useLinkTo } from '@react-navigation/native'
import { colors, btnColors, quests, questsMobile, statColors } from '../Styles.js'
import { useFonts } from 'expo-font'
import { Icon, Button } from 'react-native-elements'
import PixieStatus from './PixieStatus.js'
import { parseTime, parseTimeHour, padZero } from './Helpers.js'
import ActivityIndicatorView from './ActivityIndicatorView.js'
import { reportError, getCurrentQuests, registerQuest, cancelQuestRequest } from '../API.js'
import { net, rpcurl, communityWallet, developerWallet, baseUrl, captchaKey } from '../config.js'
import * as solanaWeb3 from '@solana/web3.js';
import ReCAPTCHA from "react-google-recaptcha";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export default function Quests(props) {

    // Nav.
    var linkTo = useLinkTo()

    // State.
    const [styles, setStyles] = useState(quests)
    const [questLog, setQuestLog] = useState([])
    const [handlingTransaction, setHandlingTransaction] = useState(false)
    const [handlingTransactionMessage, setHandlingTransactionMessage] = useState('Waiting for captcha...')
    const [chooseQuestIndex, setChooseQuestIndex] = useState(-1)
    const [pixieButtonsDisabled, setPixieButtonsDisabled] = useState("auto")
    const [potentialQuest, setPotentialQuest] = useState({})
    const [showCaptcha, setShowCaptcha] = useState(false)

    // Main starter function.
    useEffect(() => {
        if (props.width < 950) {
            setStyles(questsMobile)
        }
    }, [props.width])

    const chooseQuest = (index) => {

        setChooseQuestIndex(index)

    }

    // For presenting captcha.
    const startQuestTrigger = (quest) => {
        setHandlingTransaction(true)
        setPotentialQuest(quest)
        setShowCaptcha(true)
    }

    const onCaptchaChange = (result) => {
        setShowCaptcha(false)
        setHandlingTransactionMessage("Waiting for transaction signature...")
        startQuest()
    }

    const startQuest = async () => {
        props.selectPixiesCall()
        var quest = potentialQuest
        setPixieButtonsDisabled("none")
        const connection = new solanaWeb3.Connection(rpcurl, 'confirmed');
        const transaction = new solanaWeb3.Transaction();
        transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
        transaction.feePayer = props.provider.publicKey
        transaction.add(solanaWeb3.SystemProgram.transfer({
            fromPubkey: props.provider.publicKey,
            toPubkey: communityWallet,
            lamports: 450000,
        }));
        transaction.add(solanaWeb3.SystemProgram.transfer({
            fromPubkey: props.provider.publicKey,
            toPubkey: developerWallet,
            lamports: 200000,
        }));
        if (props.walletType == 0) {
            try {
                const { signature } = await window.solana.signAndSendTransaction(transaction);
   
                var regQuest = null
                while (regQuest == null) {
                    setHandlingTransactionMessage('Updating the blockchain...')
                    try {
                        regQuest = await registerQuest(props.provider.publicKey.toString(), props.pixie.address, quest.id, signature)
                    } catch (e) {
                        console.log(e)
                        setHandlingTransactionMessage('Connection unstable. Retrying data grab...')
                        await delay(1000)
                    }
                }
    
                if (regQuest.success) {
    
                    if (regQuest.adventure.status == 3) {
                        window.location.reload()
                    } else {
                        // Save quest and status.
                        var newNFTs = JSON.parse(JSON.stringify(props.nfts))
                        newNFTs[props.chosenPixie].questing = true
                        newNFTs[props.chosenPixie].quest = regQuest.adventure

    
                        // Update pixie and reset questing selection variables.
                        setHandlingTransactionMessage('')
                        props.setNFTs(newNFTs)
                        props.setQuest(regQuest.adventure)
                        chooseQuest(-1)
                        setHandlingTransaction(false)
                        setHandlingTransactionMessage('Waiting for captcha...')
                        setPixieButtonsDisabled("auto")
                        props.refreshData(props.provider.publicKey.toString())
                    }
                    
                } else {
                    setHandlingTransactionMessage('Transaction took too long to confirm. Please try again.')
                    setPixieButtonsDisabled("auto")
                }
            } catch (e) {
                await reportError(e)
                setHandlingTransaction(false)
                setPixieButtonsDisabled("auto")
            }
        } else {
            try {
                const signedTransaction = await window.solflare.signTransaction(transaction);
                const signature = await connection.sendRawTransaction(signedTransaction.serialize())
                setHandlingTransactionMessage('Updating the blockchain...')
    
                // Register quest off-chain.
                var regQuest = await registerQuest(props.provider.publicKey.toString(), props.pixie.address, quest.id, signature)
    
                if (regQuest.success) {
    
                    if (regQuest.adventure.status == 3) {
                        window.location.reload()
                    } else {
                        // Save quest
                        var newNFTs = JSON.parse(JSON.stringify(props.nfts))
                        newNFTs[props.chosenPixie].questing = true
                        newNFTs[props.chosenPixie].quest = regQuest.adventure
    
                        // Update pixie and reset questing selection variables.
                        setHandlingTransactionMessage('')
                        props.setNFTs(newNFTs)
                        props.setQuest(regQuest.adventure)
                        chooseQuest(-1)
                        setHandlingTransaction(false)
                        setHandlingTransactionMessage('Waiting for captcha...')
                        setPixieButtonsDisabled("auto")
                        props.refreshData(props.provider.publicKey.toString())
                    }
                    
                } else {
                    setHandlingTransactionMessage('Transaction took too long to confirm. Please try again.')
                    setPixieButtonsDisabled("auto")
                }
            } catch (e) {
                await reportError(e)
                setHandlingTransaction(false)
                setPixieButtonsDisabled("auto")
            }
        }

    }

    const cancelQuest = async (quest) => {
        setHandlingTransactionMessage("Waiting for transaction signature...")
        setHandlingTransaction(true)
        setPixieButtonsDisabled("none")
        //console.log('provider:',props.provider)
        const connection = new solanaWeb3.Connection(rpcurl);
        const transaction = new solanaWeb3.Transaction();
        transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
        transaction.feePayer = props.provider.publicKey
        transaction.add(solanaWeb3.SystemProgram.transfer({
            fromPubkey: props.provider.publicKey,
            toPubkey: communityWallet,
            lamports: 700000,
        }));
        transaction.add(solanaWeb3.SystemProgram.transfer({
            fromPubkey: props.provider.publicKey,
            toPubkey: developerWallet,
            lamports: 200000,
        }));

        if (props.walletType == 0) {
            try {
                const { signature } = await window.solana.signAndSendTransaction(transaction);
                setHandlingTransactionMessage('Updating the blockchain...')
    
                   // Register quest off-chain.
                var updateQuest = await cancelQuestRequest(props.provider.publicKey.toString(), quest.started_at, quest.id, signature)
    
                if (updateQuest.success) {
                    // Remove quest from pixie data.
                    var newNFTs = JSON.parse(JSON.stringify(props.nfts))
                    newNFTs[props.chosenPixie].questing = false
                    newNFTs[props.chosenPixie].quest = {}
    
                    // Update pixie and reset questing selection variables.
                    setHandlingTransactionMessage('')
                    props.setNFTs(newNFTs)
                    props.setQuest(regQuest.adventure)
                    chooseQuest(-1)
                    setHandlingTransaction(false)
                    setHandlingTransactionMessage('Waiting for transaction signature...')
                    setPixieButtonsDisabled("auto")
                } else {
                    setHandlingTransactionMessage('Transaction took too long to confirm. Please try again.')
                    setPixieButtonsDisabled("auto")
                }
            } catch (e) {
                await reportError(e)
                setHandlingTransaction(false)
                setPixieButtonsDisabled("auto")
            }
        } else {
            // Solflare.
            try {
                const signedTransaction = await window.solflare.signTransaction(transaction);
                const signature = await connection.sendRawTransaction(signedTransaction.serialize())
                setHandlingTransactionMessage('Updating the blockchain...')
    
                   // Register quest off-chain.
                var updateQuest = await cancelQuestRequest(props.provider.publicKey.toString(), quest.started_at, quest.id, signature)
    
                if (updateQuest.success) {
                    // Remove quest from pixie data.
                    var newNFTs = JSON.parse(JSON.stringify(props.nfts))
                    newNFTs[props.chosenPixie].questing = false
                    newNFTs[props.chosenPixie].quest = {}
    
                    // Update pixie and reset questing selection variables.
                    setHandlingTransactionMessage('')
                    props.setNFTs(newNFTs)
                    props.setQuest(regQuest.adventure)
                    chooseQuest(-1)
                    setHandlingTransaction(false)
                    setHandlingTransactionMessage('Waiting for transaction signature...')
                    setPixieButtonsDisabled("auto")
                } else {
                    setHandlingTransactionMessage('Transaction took too long to confirm. Please try again.')
                    setPixieButtonsDisabled("auto")
                }
            } catch (e) {
                await reportError(e)
                setHandlingTransaction(false)
                setPixieButtonsDisabled("auto")
            }
        }
    }

    return (<View style={styles.container}>
        {props.width > 950 && (<View style={styles.pixieContainer} pointerEvents={pixieButtonsDisabled}>
            <TouchableOpacity style={styles.backRow} onPress={() => props.choosePixie(-1)}>
                <Icon
                    name='chevron-back'
                    type='ionicon'
                    size={30}
                    color={colors.mainTextColor}
                    style={{}}
                />
                <Text style={styles.backText}>Go Back</Text>
            </TouchableOpacity>
            <View style={styles.pixieContainerInner}>
                <PixieStatus pixie={props.pixie} color={props.pixie.color} styles={styles} wallet={props.provider.publicKey.toString()} refreshData={(w) => props.refreshData(w)} />
            </View>
            {props.pixie.questing && (<View style={styles.questingButtonRow}>
                <Button 
                    title={'Cancel Quest'}
                    buttonStyle={styles.cancelQuest}
                    onPress={() => cancelQuest(props.quest)}
                />
            </View>)}
        </View>) || (<View style={styles.pixieContainer} pointerEvents={pixieButtonsDisabled}>
            <TouchableOpacity style={styles.backRow} onPress={() => props.choosePixie(-1)}>
                <Icon
                    name='chevron-back'
                    type='ionicon'
                    size={30}
                    color={colors.mainTextColor}
                    style={{}}
                />
                <Text style={styles.backText}>Go Back</Text>
            </TouchableOpacity>
            {props.pixie.questing && (<View style={styles.questingButtonRow}>
                <Button 
                    title={'Cancel Quest'}
                    buttonStyle={styles.cancelQuest}
                    onPress={() => cancelQuest(props.quest)}
                />
            </View>)}
        </View>)}
        {props.pixie.questing && (<View style={styles.questsContainer}>
            {handlingTransaction && (<View style={{flex:1}}>
                <Text style={[styles.questTitle,{paddingBottom:10}]}>Cancelling Quest...</Text>
                <Text style={styles.questTextLine}>This cannot be undone. Any potential quest rewards will be lost.</Text>
                <View style={styles.waitingSection}>
                    {handlingTransactionMessage != 'Transaction took too long to confirm. Please try again.' && 
                    (<ActivityIndicatorView size={'small'} color={props.pixie.color} />)}
                    <Text style={styles.waitingText}>{handlingTransactionMessage}</Text>
                </View>
            </View>) || (<View style={styles.questingLog}>
                <View style={styles.questInfoRow}>
                    <Text style={styles.questInfoTitle}>Quest Log: {props.quest.title}</Text>
                    {props.quest.boost == 1 && (<Text style={styles.rewardBoost}>
                        {props.quest.boost_amount}x SOL Reward Chance
                    </Text>)}
                    {props.quest.boost == 2 && (<Text style={[styles.rewardBoost,{color:props.pixie.color}]}>
                        {props.quest.boost_amount}x Bonus Points Chance
                    </Text>)}
                </View>
                <View style={[styles.startingQuestInfo,{borderLeftColor:props.pixie.color}]}>
                    <Text style={styles.questTextLine}><Text style={{color:props.pixie.color}}>{props.pixie.tribe} Tribe</Text>: Started {parseTimeHour(props.quest.duration)} quest for <Text style={styles.bold}>{props.quest.points} Points</Text>.</Text>
                </View>
                {props.quest.log.map((item, index) => {

                    return (<View style={styles.questItem} key={'questItem_'+index}>
                        <View style={styles.questInfoLine}>
                            <View style={[styles.questInfoRow,{marginBottom:10}]}>
                                <Text style={styles.questTime}>{parseTime(item.created_at)}</Text>
                                {item.health_change != 0 && (<Text style={[styles.logDetailText,{color:statColors.health}]}>
                                     {item.health_change} Health
                                </Text>)}
                                {item.magicka_change != 0 && (<Text style={[styles.logDetailText,{color:statColors.magicka}]}>
                                     {item.magicka_change} Magicka
                                </Text>)}
                                {item.stamina_change != 0 && (<Text style={[styles.logDetailText,{color:statColors.stamina}]}>
                                     {item.stamina_change} Stamina
                                </Text>)}
                            </View>
                            <Text style={styles.questTextLine}>{item.text}</Text>
                        </View>
                    </View>)
                    
                })}
                <View style={styles.waitingSection}>
                    <View style={{flexDirection:'row',alignItems:'center',marginTop:10}}>
                        <ActivityIndicatorView size={'small'} color={props.pixie.color} />
                        <Text style={styles.waitingText}>Waiting for another report...</Text>
                    </View>
                </View>
            </View>)}
        </View>) || (<View style={styles.questsContainer}>
            {chooseQuestIndex == -1 && (<View style={styles.questingLog}>
                <View style={styles.questTitleContainer}>
                    <Text style={styles.questTitle}>Choose a Quest:</Text>
                </View>
                {props.questOptions.map((quest, index) => {
                    return (<TouchableOpacity key={'quest__'+index} style={[styles.questOption,{borderLeftColor:props.pixie.color}]} onPress={() => chooseQuest(index)}>
                        <View style={styles.questInfoRow}>
                            <Text style={styles.questInfoTitle}>{quest.title} ({parseTimeHour(quest.duration, 1)})</Text>
                            {quest.boost == 1 && (<Text style={styles.rewardBoost}>
                                {quest.boost_amount}x SOL Reward Chance
                            </Text>)}
                            {quest.boost == 2 && (<Text style={[styles.rewardBoost,{color:props.pixie.color}]}>
                                {quest.boost_amount}x Bonus Points Chance
                            </Text>)}
                        </View>
                        <View>
                            <Text style={styles.questDescLine}>{quest.description}</Text>
                        </View>
                        <Text style={[styles.questInfo,{color:props.pixie.color}]}><Text style={styles.bold}>{quest.points} Points</Text></Text>
                        
                    </TouchableOpacity>)
                })}
            </View>) || (<View style={styles.questingLog}>
                <View style={styles.questingLog}>
                    <Text style={styles.questTitle}>Start this quest?</Text>
                    <View style={[styles.questOption,{borderLeftColor:props.pixie.color}]}>
                        <View style={styles.questInfoRow}>
                            <Text style={styles.questInfoTitle}>{props.questOptions[chooseQuestIndex].title} ({parseTimeHour(props.questOptions[chooseQuestIndex].duration, 1)})</Text>
                            {props.questOptions[chooseQuestIndex].boost == 1 && (<Text style={styles.rewardBoost}>
                                ({props.questOptions[chooseQuestIndex].boost_amount}x SOL Reward Chance)
                            </Text>)}
                            {props.questOptions[chooseQuestIndex].boost == 2 && (<Text style={[styles.rewardBoost,{color:props.pixie.color}]}>
                                ({props.questOptions[chooseQuestIndex].boost_amount}x Bonus Points Chance)
                            </Text>)}
                        </View>
                        <View>
                            <Text style={styles.questDescLine}>{props.questOptions[chooseQuestIndex].description}</Text>
                        </View>
                        <Text style={[styles.questInfo,{color:props.pixie.color}]}><Text style={styles.bold}>{props.questOptions[chooseQuestIndex].points} Points</Text></Text>
                    </View>
                    {handlingTransaction && (<View style={styles.waitingSection}>
                        <View style={{marginRight:10,marginTop:10}}>
                            {showCaptcha && (<ReCAPTCHA
                                sitekey={captchaKey}
                                onChange={onCaptchaChange}
                            />)}
                        </View>
                        <View style={{flexDirection:'row',alignItems:'center',marginTop:10}}>
                            {handlingTransactionMessage != 'Transaction took too long to confirm. Please try again.' && 
                            (<ActivityIndicatorView size={'small'} color={props.pixie.color} />)}
                            <Text style={styles.waitingText}>{handlingTransactionMessage}</Text>
                        </View>
                    </View>) || (<View style={styles.questingConfirmButtonRow}>
                        <Button 
                            title={'Cancel'}
                            buttonStyle={styles.cancelQuest}
                            onPress={() => chooseQuest(-1)}
                        />
                        <Button 
                            title={'Start Quest'}
                            buttonStyle={styles.startQuest}
                            onPress={() => startQuestTrigger(props.questOptions[chooseQuestIndex])}
                        />
                    </View>)}
                </View>
            </View>)}
        </View>)}
</View>)

}